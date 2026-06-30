/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import * as Match from 'effect/Match';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
import { CliRawObject, sanitizeCliJson } from '../util/cliJson';

/**
 * Raised when `sf org open --url-only --json` stdout cannot be decoded into either result shape.
 * @ExportTaggedError
 */
export class OrgOpenParseError extends Schema.TaggedError<OrgOpenParseError>()('OrgOpenParseError', {
  message: Schema.String
}) {}

const OrgOpenSuccess = Schema.Struct({
  _tag: Schema.Literal('OrgOpenSuccess'),
  result: Schema.Struct({
    orgId: Schema.String,
    url: Schema.String,
    username: Schema.String
  })
});

/** sf prints `{ status: 1, message }` on failure; preserve the old channel-message behavior. */
const OrgOpenFailure = Schema.Struct({
  _tag: Schema.Literal('OrgOpenFailure'),
  status: Schema.Literal(1),
  message: Schema.String
});

const OrgOpenResponse = Schema.Union(OrgOpenSuccess, OrgOpenFailure);
type OrgOpenResponse = Schema.Schema.Type<typeof OrgOpenResponse>;
type OrgOpenSuccess = Schema.Schema.Type<typeof OrgOpenSuccess>;
type OrgOpenFailure = Schema.Schema.Type<typeof OrgOpenFailure>;

/**
 * Decodes the sf CLI JSON from stdout. The CLI emits `{ result }` (success) or `{ status, message }`
 * (failure) — neither carries a `_tag`. `CliRawObject` parses stdout to a plain object so the `'result' in raw`
 * test can inject the discriminant before the tagged-union decode; all downstream dispatch is on `_tag` via
 * Match. Malformed/unexpected shape maps to a tagged error rather than escaping as a defect.
 */
const decodeOrgOpenResponse = (stdout: string) =>
  Schema.decodeUnknown(CliRawObject)(sanitizeCliJson(stdout)).pipe(
    Effect.map(raw => ({ ...raw, _tag: 'result' in raw ? 'OrgOpenSuccess' : 'OrgOpenFailure' })),
    Effect.flatMap(tagged => Schema.decodeUnknown(OrgOpenResponse)(tagged)),
    Effect.mapError(error => new OrgOpenParseError({ message: `Failed to parse org open response: ${error.message}` }))
  );

/**
 * Effect command for `sf.org.open`: open the default org in the browser.
 *
 * Runs `sf org open --url-only --json` and opens the returned URL via `vscode.env.openExternal`.
 * Unlike the old non-container executor (which let the CLI open the browser directly), this single
 * path always resolves the URL and opens it via openExternal — an intentional behavior unification
 * of the old container/non-container split.
 */
export const orgOpenCommand = Effect.fn('orgOpenCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  yield* api.services.ProjectService.getSfProject();

  // pass --target-org so sf resolves the default org by username rather than the extension-host cwd
  // (simpleExec runs without a workspace cwd). orgDelete uses the same pattern.
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  const targetOrgFlag = orgInfo.username ? ` --target-org ${orgInfo.username}` : '';
  if (!orgInfo.username) {
    yield* Effect.log('no target-org username; falling back to sf default-org resolution', { module: 'orgOpen' });
  }

  const terminalService = yield* api.services.TerminalService;
  // simpleExec injects SF_JSON_TO_STDOUT + FORCE_COLOR=0 for sf commands, keeping the JSON we decode clean.
  const stdout = yield* terminalService.simpleExec({
    command: `sf org open --url-only --json${targetOrgFlag}`,
    parse: identity
  });
  const response = yield* decodeOrgOpenResponse(stdout);

  const channel = yield* api.services.ChannelService;

  // both branches share the same channel epilogue (append the message, then reveal the channel);
  // they differ only in the message and the success-only openExternal side effect.
  const handleOrgOpenSuccess = Effect.fn('orgOpenCommand.handleSuccess')(function* ({
    result: { orgId, username, url }
  }: OrgOpenSuccess) {
    yield* Effect.sync(() => void vscode.env.openExternal(URI.parse(url)));
    yield* channel.appendToChannel(nls.localize('org_open_container_mode_message_text', orgId, username, url));
    yield* channel.showChannel;
  });

  // failure branch: sf prints `{ status: 1, message }` — surface the message to the channel
  const handleOrgOpenFailure = Effect.fn('orgOpenCommand.handleFailure')(function* ({ message }: OrgOpenFailure) {
    yield* channel.appendToChannel(message);
    yield* channel.showChannel;
  });

  yield* Match.type<OrgOpenResponse>().pipe(
    Match.tag('OrgOpenSuccess', handleOrgOpenSuccess),
    Match.tag('OrgOpenFailure', handleOrgOpenFailure),
    Match.exhaustive
  )(response);
});
