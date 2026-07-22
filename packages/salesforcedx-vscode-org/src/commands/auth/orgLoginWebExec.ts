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
import { isError } from 'effect/Predicate';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { getPortKillInstructions, isAuthPortConflictError } from '../../util/authErrorParser';
import { ConfigRefreshError, updateConfigAndStateAggregators } from '../../util/orgUtil';
import { showVerificationCodeIfNeeded } from '../../util/verificationCode';

/** Interactive web OAuth is human-paced; raise well above the 30s simpleExec default. */
const LOGIN_TIMEOUT = Duration.minutes(5);

/**
 * Shared executor for the `sf org login web` variants (`sf.org.login.web`, `sf.org.login.web.dev.hub`).
 * Both run the same CLI (the dev-hub variant only swaps `--instance-url/--set-default` for
 * `--set-default-dev-hub`), so they share: the Code Builder verification-code fork, the cancellable
 * progress, port-1717 conflict handling, and success (channel output + config refresh). Callers gather
 * their own params and pass the built command + progress label.
 *
 * The long-running child is wrapped in withCancellableProgress so the Cancel button interrupts the fiber
 * and aborts the child via the threaded AbortSignal. Port-conflict failures get a custom notification +
 * Show Output action; all other TerminalServiceError failures rethrow to the generic ErrorHandlerService.
 */
export const executeOrgLoginWeb = Effect.fn('executeOrgLoginWeb')(function* (params: {
  readonly command: string;
  readonly progressMessage: string;
}) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const channel = yield* api.services.ChannelService;

  // Code Builder only (gated on CODE_BUILDER_STATE inside the helper). Fork so the modal does not
  // block the login child; forkDaemon keeps it alive independent of this fiber. Best-effort: a
  // rejection from the VS Code message API becomes an Effect.promise defect — catch it explicitly so
  // the swallow is intentional and visible rather than a silent daemon-fiber drop.
  yield* Effect.forkDaemon(
    Effect.promise(() => showVerificationCodeIfNeeded()).pipe(Effect.catchAllDefect(() => Effect.void))
  );

  // Render the port-conflict notification (persistent showErrorMessage + Show Output action) directly,
  // mirroring ErrorHandlerService's pattern — no legacy notificationService/channelService singleton.
  // The conflict branch performs its own UI and short-circuits, so the happy path stays straight-line.
  const showPortConflict = Effect.fn('executeOrgLoginWeb.showPortConflict')(function* () {
    const message = `${nls.localize('org_login_web_port_conflict_notification_message')}\n\n${getPortKillInstructions()}`;
    const showOutputText = nls.localize('org_login_web_show_output_button_text');
    const selection = yield* Effect.promise(() => vscode.window.showErrorMessage(message, showOutputText));
    if (selection === showOutputText) yield* channel.showChannel;
  });

  // success: append output + success message, reveal channel, refresh aggregators
  const handleSuccess = Effect.fn('executeOrgLoginWeb.handleSuccess')(function* (output: string) {
    yield* channel.appendToChannel(output);
    yield* channel.appendToChannel(nls.localize('org_login_web_success'));
    yield* channel.showChannel;
    yield* Effect.tryPromise({
      try: () => updateConfigAndStateAggregators(),
      catch: e => new ConfigRefreshError({ message: isError(e) ? e.message : String(e) })
    });
  });

  yield* (yield* api.services.TerminalService)
    .simpleExec({ command: params.command, parse: identity, timeout: LOGIN_TIMEOUT })
    .pipe(
      (yield* api.services.PromptService).withCancellableProgress(params.progressMessage),
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
