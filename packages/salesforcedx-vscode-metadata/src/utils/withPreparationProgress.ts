/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Runtime from 'effect/Runtime';
import type { NonEmptyComponentSet, UserCancellationError } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { nls } from '../messages';

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
 * 1. `"Preparing {deployment|retrieval|deletion}..."` — shown while the ComponentSet is built by the upstream `prepare` effect.
 * 2. `"Checking for conflicts..."` — shown only when `detectConflictsFn` is provided and the ComponentSet was built successfully.
 *
 * The notification closes automatically when the preparation completes (success or failure)
 * or when the user presses the Cancel button.
 *
 * **Cancellation:** When the user cancels, the active sub-effect (prepare or conflict detection)
 * is interrupted via a cancellation Deferred raced against each phase. The operator then fails
 * with {@link UserCancellationError}, which is silently swallowed by `registerCommandWithLayer`
 * (same as all other command cancellations).
 *
 * **Conflict errors:** Any error thrown by `detectConflictsFn` (e.g. `ConflictsDetectedError`) is
 * propagated unchanged through the pipeline so command handlers can still
 * `Effect.catchTag('ConflictsDetectedError', ...)`.
 *
 * @param operationType - Determines the initial notification title.
 * @param detectConflictsFn - Optional conflict detection effect to run after the prepare phase. When omitted (e.g. when `ignoreConflicts` is true), both the conflict phase and its "Checking for conflicts..." message update are skipped.
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
    detectConflictsFn?: (cs: NonEmptyComponentSet) => Effect.Effect<void, ConflictsE, ConflictsR>
  ) =>
  <E, R>(prepare: Effect.Effect<NonEmptyComponentSet, E, R>) =>
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const runtime = yield* Effect.runtime<R | ConflictsR>();
      const cancelDeferred = yield* Deferred.make<never, UserCancellationError>();

      const raceWithCancel = <A, E2, R2>(effect: Effect.Effect<A, E2, R2>) =>
        Effect.raceFirst(effect, Deferred.await(cancelDeferred));

      return yield* Effect.async<NonEmptyComponentSet, E | ConflictsE | UserCancellationError>(resume => {
        void vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            cancellable: true
          },
          async (progress, token) => {
            token.onCancellationRequested(() =>
              void Runtime.runPromise(runtime)(
                Deferred.fail(cancelDeferred, new api.services.UserCancellationError())
              )
            );

            const report = (key: Parameters<typeof nls.localize>[0]) =>
              Effect.sync(() => progress.report({ message: nls.localize(key) }));

            const pipeline = Effect.gen(function* () {
              yield* report(titleKey(operationType));
              const cs = yield* raceWithCancel(prepare);
              if (detectConflictsFn) {
                yield* report('checking_for_conflicts');
                yield* raceWithCancel(detectConflictsFn(cs));
              }
              return cs;
            });

            const exit = await Runtime.runPromise(runtime)(Effect.exit(pipeline));
            resume(Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause));
          }
        );
      });
    });
