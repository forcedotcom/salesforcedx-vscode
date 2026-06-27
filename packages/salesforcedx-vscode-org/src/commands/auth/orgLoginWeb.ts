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
import * as Option from 'effect/Option';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { getPortKillInstructions, isAuthPortConflictError } from '../../util/authErrorParser';
import { updateConfigAndStateAggregators } from '../../util/orgUtil';
import { showVerificationCodeIfNeeded } from '../../util/verificationCode';
import { gatherAuthParams } from './authParamsGatherer';

/** Interactive web OAuth is human-paced; raise well above the 30s simpleExec default. */
const LOGIN_TIMEOUT = Duration.minutes(5);

/**
 * Effect command for `sf.org.login.web`: gather alias + login URL, then run `sf org login web`.
 *
 * Replaces the old SfCommandlet/CliCommandExecutor executor. The command string is built from the
 * gathered alias + instance URL; simpleExec injects SF_JSON_TO_STDOUT + FORCE_COLOR=0 for the `sf `
 * prefix. The long-running child is wrapped in withCancellableProgress so the Cancel button
 * interrupts the fiber and aborts the child via the threaded AbortSignal.
 *
 * Port-conflict failures (local port 1717 already bound) get a custom notification + Show Output
 * action rather than the generic ErrorHandlerService rendering; all other TerminalServiceError
 * failures rethrow to the generic handler.
 */
export const orgLoginWebCommand = Effect.fn('orgLoginWebCommand')(function* (
  instanceUrl?: string,
  reauthAliasOrUsername?: string
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  // precondition: getSfProject sets the sf:project_opened context and fails with a typed
  // FailedToResolveSfProjectError (rendered by ErrorHandlerService) when there's no project.
  yield* api.services.ProjectService.getSfProject();

  const { alias, loginUrl } = yield* gatherAuthParams({ instanceUrl, reauthAliasOrUsername });

  const promptService = yield* api.services.PromptService;
  const terminalService = yield* api.services.TerminalService;
  const channel = yield* api.services.ChannelService;

  // Render the port-conflict notification (persistent showErrorMessage + Show Output action) directly,
  // mirroring ErrorHandlerService's pattern — no legacy notificationService/channelService singleton.
  const showPortConflict = Effect.fn('orgLoginWebCommand.showPortConflict')(function* () {
    const message = `${nls.localize('org_login_web_port_conflict_notification_message')}\n\n${getPortKillInstructions()}`;
    const showOutputText = nls.localize('org_login_web_show_output_button_text');
    const selection = yield* Effect.promise(() =>
      Promise.resolve(vscode.window.showErrorMessage(message, showOutputText))
    );
    if (selection === showOutputText) yield* channel.showChannel;
    return Option.none<string>();
  });

  // Code Builder only (gated on CODE_BUILDER_STATE inside the helper). Fork so the modal does not
  // block the login child; forkDaemon keeps it alive independent of this fiber.
  yield* Effect.forkDaemon(Effect.promise(() => showVerificationCodeIfNeeded()));

  // quote alias + url so spaces/special chars in the alias don't split the shell command
  const command = `sf org login web --alias "${alias}" --instance-url "${loginUrl}" --set-default --json`;

  // Option.some(output) on success; Option.none() when the port-conflict branch already handled it.
  const result = yield* terminalService.simpleExec({ command, parse: identity, timeout: LOGIN_TIMEOUT }).pipe(
    Effect.map(Option.some<string>),
    promptService.withCancellableProgress(nls.localize('org_login_web_progress')),
    Effect.catchTag('TerminalServiceError', error =>
      isAuthPortConflictError(error.message)
        ? showPortConflict()
        : // non-conflict failure: rethrow to the generic ErrorHandlerService
          Effect.fail(error)
    )
  );

  if (Option.isNone(result)) return;

  yield* channel.appendToChannel(result.value);
  yield* channel.appendToChannel(nls.localize('org_login_web_success'));
  yield* channel.showChannel;
  yield* Effect.promise(() => updateConfigAndStateAggregators());
});
