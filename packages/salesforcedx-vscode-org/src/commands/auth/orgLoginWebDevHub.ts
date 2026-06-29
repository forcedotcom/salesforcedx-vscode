/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { identity } from 'effect/Function';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { updateConfigAndStateAggregators } from '../../util/orgUtil';
import { showVerificationCodeIfNeeded } from '../../util/verificationCode';
import { DEFAULT_ALIAS } from './authParamsGatherer';

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

  // Closing the dialog (ESC/cancel → undefined) cancels; hitting enter with no alias defaults to 'vscodeOrg'.
  // Mirrors the authParamsGatherer alias block: empty string is a valid "use default" answer, so only
  // undefined cancels (NOT considerUndefinedAsCancellation, which would also reject empty).
  const alias = yield* Effect.promise(() =>
    vscode.window.showInputBox({
      prompt: nls.localize('parameter_gatherer_enter_alias_name'),
      placeHolder: DEFAULT_ALIAS
    })
  ).pipe(
    Effect.flatMap(value => (value === undefined ? new api.services.UserCancellationError({}) : Effect.succeed(value)))
  );

  // Show the verification code modal (CODE_BUILDER_STATE only; no-op otherwise) BEFORE exec so the code
  // is visible while the browser auth flow proceeds (preserves the old ordering). Yielded into the runtime
  // rather than fire-and-forget so the modal's lifecycle is part of this fiber.
  yield* Effect.promise(() => showVerificationCodeIfNeeded());

  const terminalService = yield* api.services.TerminalService;
  // simpleExec injects SF_JSON_TO_STDOUT + FORCE_COLOR=0 for sf commands; no need to set env here.
  yield* terminalService.simpleExec({
    command: `sf org login web --alias ${alias || DEFAULT_ALIAS} --set-default-dev-hub`,
    parse: identity
  });

  yield* Effect.promise(() => updateConfigAndStateAggregators());
});
