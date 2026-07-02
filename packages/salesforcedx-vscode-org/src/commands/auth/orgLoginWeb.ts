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
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { getPortKillInstructions, isAuthPortConflictError } from '../../util/authErrorParser';
import { ConfigRefreshError, updateConfigAndStateAggregators } from '../../util/orgUtil';
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

  const channel = yield* api.services.ChannelService;

  // Code Builder only (gated on CODE_BUILDER_STATE inside the helper). Fork so the modal does not
  // block the login child; forkDaemon keeps it alive independent of this fiber. Best-effort: a
  // rejection from the VS Code message API becomes an Effect.promise defect — catch it explicitly so
  // the swallow is intentional and visible rather than a silent daemon-fiber drop.
  yield* Effect.forkDaemon(
    Effect.promise(() => showVerificationCodeIfNeeded()).pipe(Effect.catchAllDefect(() => Effect.void))
  );

  // quote alias + url so spaces/special chars in the alias don't split the shell command. Note: double
  // quotes do NOT neutralize $, backticks, or an embedded " under /bin/sh -c; real-world risk is low
  // (alias is locally user-typed, loginUrl is validateUrl-checked) but this is not full shell escaping.
  const command = `sf org login web --alias "${alias}" --instance-url "${loginUrl}" --set-default --json`;

  // Render the port-conflict notification (persistent showErrorMessage + Show Output action) directly,
  // mirroring ErrorHandlerService's pattern — no legacy notificationService/channelService singleton.
  // The conflict branch performs its own UI and short-circuits, so the happy path stays straight-line.
  const showPortConflict = Effect.fn('orgLoginWebCommand.showPortConflict')(function* () {
    const message = `${nls.localize('org_login_web_port_conflict_notification_message')}\n\n${getPortKillInstructions()}`;
    const showOutputText = nls.localize('org_login_web_show_output_button_text');
    const selection = yield* Effect.promise(() => vscode.window.showErrorMessage(message, showOutputText));
    if (selection === showOutputText) yield* channel.showChannel;
  });

  // success: append output + success message, reveal channel, refresh aggregators
  const handleSuccess = Effect.fn('orgLoginWebCommand.handleSuccess')(function* (output: string) {
    yield* channel.appendToChannel(output);
    yield* channel.appendToChannel(nls.localize('org_login_web_success'));
    yield* channel.showChannel;
    yield* Effect.tryPromise({
      try: () => updateConfigAndStateAggregators(),
      catch: e => new ConfigRefreshError({ message: e instanceof Error ? e.message : String(e) })
    });
  });

  yield* (yield* api.services.TerminalService).simpleExec({ command, parse: identity, timeout: LOGIN_TIMEOUT }).pipe(
    (yield* api.services.PromptService).withCancellableProgress(nls.localize('org_login_web_progress')),
    Effect.flatMap(handleSuccess),
    Effect.catchTag('TerminalServiceError', error =>
      isAuthPortConflictError(error.message)
        ? // port-conflict: handle the conflict UI inline and short-circuit
          showPortConflict()
        : // non-conflict failure: rethrow to the generic ErrorHandlerService
          Effect.fail(error)
    )
  );
});
