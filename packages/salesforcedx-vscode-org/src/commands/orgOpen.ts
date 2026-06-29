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

/**
 * Raised when `sf org open --url-only --json` stdout cannot be decoded into either result shape.
 * @ExportTaggedError
 */
export class OrgOpenParseError extends Schema.TaggedError<OrgOpenParseError>()('OrgOpenParseError', {
  message: Schema.String
}) {}

const OrgOpenSuccess = Schema.Struct({
  _tag: Schema.Literal('OrgOpenSuccess'),
  status: Schema.Literal(0),
  result: Schema.Struct({
    orgId: Schema.String,
    url: Schema.String,
    username: Schema.String
  })
});

/** sf failure shape: `{ status: <non-zero>, message }`. */
const OrgOpenFailure = Schema.Struct({
  _tag: Schema.Literal('OrgOpenFailure'),
  status: Schema.Number,
  message: Schema.String
});

const OrgOpenResponse = Schema.Union(OrgOpenSuccess, OrgOpenFailure);
type OrgOpenResponse = Schema.Schema.Type<typeof OrgOpenResponse>;
type OrgOpenSuccess = Schema.Schema.Type<typeof OrgOpenSuccess>;
type OrgOpenFailure = Schema.Schema.Type<typeof OrgOpenFailure>;

/**
 * Decode sf CLI JSON. Inject `_tag` from `status` (0 = success) before the union decode, since the
 * raw shapes carry no discriminant. Malformed shape → tagged error, not a defect.
 */
const RawObject = Schema.parseJson(Schema.Record({ key: Schema.String, value: Schema.Unknown }));
/**
 * The sf CLI can prepend non-JSON lines to stdout even with `--json` (e.g. the scratch-org expiration warning,
 * seen on macOS CI). Slice from the first `{` to the last `}` to isolate the JSON payload before decoding
 * (parity with the old OrgOpenContainerResultParser). No braces → slice yields '' → OrgOpenParseError, not a defect.
 */
const sanitizeJson = (stdout: string) => stdout.substring(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
const decodeOrgOpenResponse = (stdout: string) =>
  Schema.decodeUnknown(RawObject)(sanitizeJson(stdout)).pipe(
    Effect.map(raw => ({ ...raw, _tag: raw.status === 0 ? 'OrgOpenSuccess' : 'OrgOpenFailure' })),
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
