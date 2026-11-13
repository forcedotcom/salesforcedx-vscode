/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { NonEmptyComponentSet } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { type CommandKey } from './notificationMode';

type OperationType = 'deploy' | 'retrieve' | 'delete';

const titleKey = (op: OperationType) =>
  op === 'deploy'
    ? ('preparing_deployment' as const)
    : op === 'retrieve'
      ? ('preparing_retrieval' as const)
      : ('preparing_deletion' as const);

/**
 * Pipeable Effect operator that shows a VS Code progress notification during the
 * preparation phase of a deploy/retrieve/delete command.
 *
 * The notification opens immediately when the operator begins executing — before the
 * preparation effect runs — so users see feedback the moment they invoke the command.
 *
 * **Two-phase notification behavior:**
 * 1. `"Preparing {deployment|retrieval|deletion}..."` — shown as the progress title while the ComponentSet is built.
 * 2. `"Checking for conflicts..."` — reported only when `detectConflictsFn` is provided and the ComponentSet was built successfully.
 *
 * The notification closes automatically when the preparation completes (success or failure)
 * or when the user presses the Cancel button.
 *
 * **Cancellation:** When the user cancels, the active sub-effect (prepare or conflict detection)
 * is interrupted by PromptService. The operator then fails
 * with `UserCancellationError`, which is silently swallowed by `registerCommandWithRuntime`
 * (same as all other command cancellations).
 *
 * **Conflict errors:** Any error thrown by `detectConflictsFn` (e.g. `ConflictsDetectedError`) is
 * propagated unchanged through the pipeline so command handlers can still
 * `Effect.catchTag('ConflictsDetectedError', ...)`.
 *
 * @param operationType - Determines the initial notification title.
 * @param detectConflictsFn - Optional conflict detection effect to run after the prepare phase. When omitted (e.g. when `ignoreConflicts` is true), both the conflict phase and its "Checking for conflicts..." message update are skipped.
 * @param command - Optional command key used to resolve the VS Code progress location (toast vs. status bar) via `NotificationModeService`.
 *
 * @example
 * Deploy with conflict detection:
 * ```ts
 * buildComponentSet.pipe(
 *   Effect.flatMap(ensureNonEmptyComponentSet),
 *   withPreparationProgress('deploy', cs => detectConflicts(cs, 'deploy')),
 *   Effect.flatMap(cs => deployComponentSet({ componentSet: cs }))
 * )
 * ```
 *
 * @example
 * Deploy ignoring conflicts (no conflict phase):
 * ```ts
 * buildComponentSet.pipe(
 *   Effect.flatMap(ensureNonEmptyComponentSet),
 *   withPreparationProgress('deploy'),
 *   Effect.flatMap(cs => deployComponentSet({ componentSet: cs }))
 * )
 * ```
 */
export const withPreparationProgress =
  // ConflictsE/ConflictsR capture the error and requirements of detectConflictsFn so callers
  // can still catchTag('ConflictsDetectedError', ...) and the runtime requirement is explicit.
  <ConflictsE = never, ConflictsR = never>(
      operationType: OperationType,
      detectConflictsFn?: (cs: NonEmptyComponentSet) => Effect.Effect<void, ConflictsE, ConflictsR>,
      command?: CommandKey
    ) =>
    <E, R>(prepare: Effect.Effect<NonEmptyComponentSet, E, R>) =>
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const promptService = yield* api.services.PromptService;
        const title = nls.localize(titleKey(operationType));
        const build = (progress: vscode.Progress<{ increment?: number; message?: string }>) =>
          Effect.gen(function* () {
            const cs = yield* prepare;
            if (detectConflictsFn) {
              yield* Effect.sync(() => progress.report({ message: nls.localize('checking_for_conflicts') }));
              yield* detectConflictsFn(cs);
            }
            return cs;
          });
        return yield* command
          ? promptService.withProgressReporting({ command, title, cancellable: true })(build)
          : promptService.withProgressReporting({
              location: vscode.ProgressLocation.Notification,
              title,
              cancellable: true
            })(build);
      });
