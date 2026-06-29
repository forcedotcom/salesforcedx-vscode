/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { updateConfigAndStateAggregators } from '../../util/orgUtil';
import { showVerificationCodeIfNeeded } from '../../util/verificationCode';
import { DEFAULT_ALIAS } from './authParamsGatherer';

/** Interactive browser auth blocks on a human completing login, which routinely exceeds the 30s
 * simpleExec default; give it a generous bound (parity with orgDelete's raised timeout). */
const LOGIN_TIMEOUT = Duration.minutes(10);

/** Alias is validated to alphanumeric/underscore/space at input, so single-quoting (no embedded quotes to
 * escape) safely passes it as one shell argument — closing the shell-injection vector of an unquoted interpolation. */
const isAlphaNumSpaceString = (value: string | undefined): boolean =>
  value !== undefined && /^\w+( *\w*)*$/.test(value);

/**
 * Raised when the verification-code modal throws (e.g. a vscode API change); keeps the failure typed and
 * rendered by ErrorHandlerService rather than escaping the runtime as a defect.
 * @ExportTaggedError
 */
export class OrgLoginVerificationError extends Schema.TaggedError<OrgLoginVerificationError>()(
  'OrgLoginVerificationError',
  { message: Schema.String }
) {}

/**
 * Effect command for `sf.org.login.web.dev.hub`: prompt for an alias, then run
 * `sf org login web --alias <alias> --set-default-dev-hub` (interactive browser auth).
 *
 * Telemetry: the root span name `sf.org.login.web.dev.hub` IS the telemetry event name (set by
 * registerCommandWithLayer); this intentionally renames the old `org_login_web_dev_hub` key — same
 * migration orgOpen made. No manual logMetric.
 */
export const orgLoginWebDevHubCommand = Effect.fn('orgLoginWebDevHubCommand')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  yield* api.services.ProjectService.getSfProject();

  const promptService = yield* api.services.PromptService;

  // Closing the dialog (ESC/cancel → undefined) cancels; hitting enter with no alias defaults to 'vscodeOrg'.
  // Mirrors the authParamsGatherer alias block: empty string is a valid "use default" answer, so only
  // undefined cancels (NOT considerUndefinedAsCancellation, which would also reject empty). validateInput
  // blocks shell metacharacters so the value is safe to interpolate into the shell command below.
  // Normalize once here (empty → default) so the binding is always a non-empty validated string.
  const alias = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: DEFAULT_ALIAS,
      ignoreFocusOut: true,
      validateInput: value =>
        isAlphaNumSpaceString(value) || value === '' ? undefined : nls.localize('error_invalid_org_alias')
    })
  ).pipe(
    Effect.flatMap(value =>
      value === undefined
        ? new api.services.UserCancellationError({})
        : Effect.succeed(value === '' ? DEFAULT_ALIAS : value)
    )
  );

  // Show the verification code modal (CODE_BUILDER_STATE only; no-op otherwise) BEFORE exec so the code
  // is visible while the browser auth flow proceeds (preserves the old ordering). tryPromise keeps a modal
  // failure typed (OrgLoginVerificationError) instead of a defect that escapes the runtime.
  yield* Effect.tryPromise({
    try: () => showVerificationCodeIfNeeded(),
    catch: e =>
      new OrgLoginVerificationError({ message: e instanceof Error ? e.message : 'verification code modal failed' })
  });

  const terminalService = yield* api.services.TerminalService;
  // simpleExec injects SF_JSON_TO_STDOUT + FORCE_COLOR=0 for sf commands; no need to set env here.
  // Wrap in a cancellable progress: clicking Cancel interrupts this fiber, aborting the runtime
  // AbortSignal simpleExec threads into exec, killing the long-running interactive sf child.
  yield* terminalService
    .simpleExec({
      command: `sf org login web --alias '${alias}' --set-default-dev-hub`,
      parse: identity,
      timeout: LOGIN_TIMEOUT
    })
    .pipe(promptService.withCancellableProgress(nls.localize('org_login_web_authorize_dev_hub_text')));

  yield* Effect.promise(() => updateConfigAndStateAggregators());
});
