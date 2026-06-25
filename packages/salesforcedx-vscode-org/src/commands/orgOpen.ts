/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import * as Schema from 'effect/Schema';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { channelService } from '../channels';
import { nls } from '../messages';

/** Shown when there is no open Salesforce project; surfaced through the command error channel so
 * ErrorHandlerService renders it via a single showErrorMessage (parity with sfProjectPreconditionChecker). */
class NoSalesforceProjectError extends Schema.TaggedError<NoSalesforceProjectError>()('NoSalesforceProjectError', {
  message: Schema.String
}) {}

/** Raised when `sf org open --url-only --json` stdout cannot be decoded into either result shape. */
class OrgOpenParseError extends Schema.TaggedError<OrgOpenParseError>()('OrgOpenParseError', {
  message: Schema.String
}) {}

const OrgOpenSuccess = Schema.Struct({
  status: Schema.Literal(0),
  result: Schema.Struct({
    orgId: Schema.String,
    url: Schema.String,
    username: Schema.String
  })
});

/** sf prints `{ status: 1, message }` on failure; preserve the old channel-message behavior. */
const OrgOpenFailure = Schema.Struct({
  status: Schema.Number,
  message: Schema.String
});

/** Decodes the sf CLI JSON string from stdout, mapping a malformed JSON / unexpected shape to a tagged
 * error rather than letting a SyntaxError/ParseError escape as a defect. */
const OrgOpenResponse = Schema.parseJson(Schema.Union(OrgOpenSuccess, OrgOpenFailure));
const decodeOrgOpenResponse = (stdout: string) =>
  Schema.decodeUnknown(OrgOpenResponse)(stdout).pipe(
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

  // precondition (load-bearing): isSalesforceProject also sets the sf:project_opened context as a side
  // effect (parity with sfProjectPreconditionChecker). Surface as a tagged error so ErrorHandlerService
  // shows the localized message via a single showErrorMessage.
  const isProject = yield* api.services.ProjectService.isSalesforceProject();
  if (!isProject) {
    return yield* new NoSalesforceProjectError({
      message: nls.localize('org_open_no_salesforce_project_text')
    });
  }

  // pass --target-org so sf resolves the default org by username rather than the extension-host cwd
  // (simpleExec runs without a workspace cwd). orgDelete uses the same pattern.
  const orgInfo = yield* SubscriptionRef.get(yield* api.services.TargetOrgRef());
  const targetOrgFlag = orgInfo.username ? ` --target-org ${orgInfo.username}` : '';
  if (!orgInfo.username) {
    yield* Effect.logInfo('[orgOpen] no target-org username; falling back to sf default-org resolution');
  }

  const terminalService = yield* api.services.TerminalService;
  // SF_JSON_TO_STDOUT keeps JSON stdout clean across sf CLI versions (the old container path set it);
  // required because we decode stdout as JSON.
  const stdout = yield* terminalService.simpleExec({
    command: `sf org open --url-only --json${targetOrgFlag}`,
    parse: identity,
    env: { SF_JSON_TO_STDOUT: 'true' }
  });
  const response = yield* decodeOrgOpenResponse(stdout);

  const channel = yield* api.services.ChannelService;

  if (!('result' in response)) {
    // failure branch: sf prints `{ status: 1, message }` — surface the message to the channel
    yield* channel.appendToChannel(response.message);
    yield* Effect.sync(() => {
      channelService.showChannelOutput();
    });
    return;
  }

  const { orgId, username, url } = response.result;
  yield* Effect.sync(() => void vscode.env.openExternal(URI.parse(url)));
  yield* channel.appendToChannel(nls.localize('org_open_container_mode_message_text', orgId, username, url));
  yield* Effect.sync(() => {
    channelService.showChannelOutput();
  });
});
