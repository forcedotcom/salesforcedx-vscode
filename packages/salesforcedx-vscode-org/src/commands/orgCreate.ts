/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import { getTargetDevHubOrAlias } from '@salesforce/salesforcedx-utils-vscode';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import * as Match from 'effect/Match';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import { nls } from '../messages';
import { decodeTaggedCliResponse } from '../util/cliJson';
import { updateConfigAndStateAggregators } from '../util/orgUtil';

const isAlphaNumSpaceString = (value: string | undefined): boolean =>
  value !== undefined && /^\w+( *\w*)*$/.test(value);

const isInteger = (value: string | undefined): boolean =>
  value !== undefined && !/\D/.test(value) && Number.isSafeInteger(Number.parseInt(value, 10));

const isIntegerInRange = (value: string | undefined, range: [number, number]): boolean =>
  value !== undefined &&
  isInteger(value) &&
  Number.parseInt(value, 10) >= range[0] &&
  Number.parseInt(value, 10) <= range[1];

const DEFAULT_ALIAS = 'vscodeScratchOrg';
const DEFAULT_EXPIRATION_DAYS = '7';

/** scratch-org creation can run several minutes; the default 30s simpleExec timeout would kill it. */
const CREATE_TIMEOUT = Duration.minutes(15);

/**
 * Raised when `sf org create scratch --json` stdout cannot be decoded into either result shape.
 * @ExportTaggedError
 */
export class OrgCreateParseError extends Schema.TaggedError<OrgCreateParseError>()('OrgCreateParseError', {
  message: Schema.String
}) {}

const OrgCreateSuccess = Schema.TaggedStruct('OrgCreateSuccess', {
  status: Schema.Literal(0),
  result: Schema.Struct({
    orgId: Schema.String,
    username: Schema.String
  })
});

/** sf prints `{ status, message }` (status !== 0) on failure; preserve the old channel-message behavior. */
const OrgCreateFailure = Schema.TaggedStruct('OrgCreateFailure', {
  status: Schema.Number,
  message: Schema.String
});

const OrgCreateResponse = Schema.Union(OrgCreateSuccess, OrgCreateFailure);
type OrgCreateResponse = Schema.Schema.Type<typeof OrgCreateResponse>;
type OrgCreateSuccess = Schema.Schema.Type<typeof OrgCreateSuccess>;
type OrgCreateFailure = Schema.Schema.Type<typeof OrgCreateFailure>;

/**
 * Decodes sf CLI JSON: `{ status: 0, result }` (success) or `{ status, message }` (failure) — neither
 * carries a `_tag`. Inject the discriminant from `status === 0` before the tagged-union decode; all
 * downstream dispatch is on `_tag` via Match. Malformed shape → tagged error. See `cliJson.ts`.
 */
const decodeOrgCreateResponse = decodeTaggedCliResponse(OrgCreateResponse, raw =>
  raw.status === 0 ? 'OrgCreateSuccess' : 'OrgCreateFailure'
)(() => new OrgCreateParseError({ message: nls.localize('org_create_result_parsing_error') }));

/**
 * Prompts for the three scratch-org inputs (def file / alias / expiration) and returns them.
 * Extracted from `orgCreateCommand` so the command body stays a flat gate→gather→run→dispatch read.
 * Cancellation (Esc) and the empty-scratch-def case short-circuit here via `UserCancellationError`.
 */
const gatherOrgCreateInputs = Effect.fn('orgCreateCommand.gatherInputs')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const promptService = yield* api.services.PromptService;

  // def-file pick: empty match → show the no-scratch-def error and cancel (parity with FileSelector).
  // FsService.findFiles routes through the web/virtual FS provider when ESBUILD_PLATFORM === 'web'
  // (vscode.workspace.findFiles is desktop-only).
  const files = yield* api.services.FsService.findFiles('config/**/*-scratch-def.json');
  if (files.length === 0) {
    yield* Effect.promise(() => vscode.window.showErrorMessage(nls.localize('error_no_scratch_def'))).pipe(
      Effect.ignore
    );
    return yield* new api.services.UserCancellationError({});
  }
  const fileItems = files.map(file => ({ label: Utils.basename(file), description: file.fsPath }));
  const selection = yield* Effect.promise(() =>
    vscode.window.showQuickPick(fileItems, {
      placeHolder: nls.localize('parameter_gatherer_enter_scratch_org_def_files')
    })
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));
  // absolute fsPath, NOT a workspace-relative path: simpleExec runs the sf child with no cwd (it inherits the
  // extension-host process.cwd(), not the workspace root), so a relative --definition-file would not resolve.
  // double-quote it (at the call site) so paths containing spaces survive shell word-splitting.
  const defFilePath = selection.description;

  // alias default = sanitized workspace folder name (or DEFAULT_ALIAS), pre-filled as the input `value`
  // so Enter accepts it. The default is always a valid value, so an empty box only happens if the user
  // clears it (validation then rejects it); Esc → undefined → considerUndefinedAsCancellation.
  const { uri } = yield* api.services.WorkspaceService.getWorkspaceInfo();
  const folderName = Utils.basename(uri).replaceAll(/\W/g, '');
  const defaultAlias = isAlphaNumSpaceString(folderName) ? folderName : DEFAULT_ALIAS;
  const alias = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      value: defaultAlias,
      validateInput: value => (isAlphaNumSpaceString(value) ? undefined : nls.localize('error_invalid_org_alias'))
    })
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));

  const days = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('parameter_gatherer_enter_scratch_org_expiration_days'),
      value: DEFAULT_EXPIRATION_DAYS,
      validateInput: value =>
        isIntegerInRange(value, [1, 30]) ? undefined : nls.localize('error_invalid_expiration_days')
    })
  ).pipe(Effect.flatMap(promptService.considerUndefinedAsCancellation));

  return { defFilePath, alias, days };
});

/**
 * Effect command for `sf.org.create`: create a default scratch org.
 *
 * Gates on a configured Dev Hub and an open SfProject, prompts for a scratch-def file / alias /
 * expiration, then runs `sf org create scratch ... --set-default --json` via TerminalService inside a
 * cancellable progress. Success refreshes the config/state aggregators and reports to the channel; a
 * non-zero CLI status surfaces the message to the channel (parity with the old executor).
 */
export const orgCreateCommand = Effect.fn('orgCreateCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // gates are independent → run concurrently. getSfProject sets the sf:project_opened context and fails
  // with a typed FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project;
  // getTargetDevHub yields ConfigService directly (NOT the old checkDevHubConfigured, which nested a
  // runPromise inside an Effect).
  const [, devHub] = yield* Effect.all(
    [api.services.ProjectService.getSfProject(), api.services.ConfigService.getTargetDevHub()],
    { concurrency: 'unbounded' }
  );
  // no devhub → show the same "no dev hub" warning and cancel.
  if (devHub === undefined) {
    yield* Effect.promise(() => getTargetDevHubOrAlias(true)).pipe(Effect.ignore);
    return yield* new api.services.UserCancellationError({});
  }

  const { defFilePath, alias, days } = yield* gatherOrgCreateInputs();

  const promptService = yield* api.services.PromptService;
  const terminalService = yield* api.services.TerminalService;
  // wrap in a cancellable progress: clicking Cancel interrupts this fiber, aborting the sf child.
  // quote alias: validateInput (isAlphaNumSpaceString) permits embedded spaces, and childProcess.exec runs
  // via /bin/sh -c, so an unquoted `--alias my org` would word-split. days is digits-only (no quoting needed).
  const command = `sf org create scratch --definition-file "${defFilePath}" --alias "${alias}" --duration-days ${days} --set-default --json`;
  const stdout = yield* terminalService
    .simpleExec({ command, parse: identity, timeout: CREATE_TIMEOUT })
    .pipe(promptService.withCancellableProgress(nls.localize('org_create_progress')));

  const response = yield* decodeOrgCreateResponse(stdout);

  // success: refresh the config/state aggregators (default org flipped by --set-default), report to the
  // channel, then show the `... successfully ran` toast (parity with the old SfCommandletExecutor).
  const handleSuccess = Effect.fn('orgCreateCommand.handleSuccess')(function* ({
    result: { orgId, username }
  }: OrgCreateSuccess) {
    const channel = yield* api.services.ChannelService;
    yield* Effect.promise(() => updateConfigAndStateAggregators());
    yield* channel.appendToChannel(nls.localize('org_create_success', alias, username, orgId));
    yield* channel.showChannel;
    // in-layer channel already revealed above, so the toast's "Show" button is redundant — emit a plain
    // information toast directly via vscode.window (no legacy NotificationService / ../channels singleton).
    yield* Effect.promise(() => vscode.window.showInformationMessage(nls.localize('org_create_successfully_ran'))).pipe(
      Effect.ignore
    );
  });

  // failure branch: sf prints `{ status, message }` — surface the message to the channel (no aggregator refresh).
  // NOTE: the old executor sent telemetryService.sendException('org_create', message) here and
  // 'org_create_scratch' on parse errors. Both are intentionally dropped: migrated Effect org commands
  // (orgOpen, orgDeleteDefaultCommand) emit no failure-exception telemetry; OrgCreateParseError flows to
  // ErrorHandlerService for user-facing rendering instead.
  const handleFailure = Effect.fn('orgCreateCommand.handleFailure')(function* ({ message }: OrgCreateFailure) {
    const channel = yield* api.services.ChannelService;
    yield* channel.appendToChannel(message);
    yield* channel.showChannel;
  });

  yield* Match.type<OrgCreateResponse>().pipe(
    Match.tag('OrgCreateSuccess', handleSuccess),
    Match.tag('OrgCreateFailure', handleFailure),
    Match.exhaustive
  )(response);
});
