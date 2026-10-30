/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as vscode from 'vscode';
import { finalizerFailureCause } from './scopedFiber.js';

/** SDK public promises only; cancellation failure never replaces the server's actual outcome. */
const startNativeMetadataOperation = <A, E>(
  start: () => Promise<{ readonly pollStatus: () => Promise<A>; readonly cancel: () => Promise<unknown> }>,
  options: vscode.ProgressOptions,
  failure: (cause: unknown) => E
) => {
  let operation: Awaited<ReturnType<typeof start>> | undefined;
  let cancelRequested = false;
  let pollCompleted = false;
  let settled = false;
  let cancellation: Promise<Exit.Exit<void, E>> | undefined;
  const requestCancel = () => {
    cancelRequested = true;
    if (operation && !pollCompleted && !cancellation) {
      const started = operation;
      cancellation = Promise.resolve()
        .then(() => started.cancel())
        .then(
          () => Exit.succeed(undefined),
          cause => Exit.fail(failure(cause))
        );
    }
  };
  const completed = Promise.resolve(
    vscode.window.withProgress(options, async (_progress, token) => {
      // ComponentSet.deploy starts before returning its operation; register first and replay after the ID exists.
      const listener = token.onCancellationRequested(requestCancel);
      try {
        if (token.isCancellationRequested) requestCancel();
        operation = await start();
        if (cancelRequested) requestCancel();
        return await operation.pollStatus();
      } finally {
        pollCompleted = true;
        listener.dispose();
      }
    })
  )
    .then(
      value => Exit.succeed(value),
      cause => Exit.fail(failure(cause))
    )
    .then(async result => {
      const cancelExit = cancellation ? await cancellation : Exit.succeed(undefined);
      settled = true;
      return { result, cancellation: cancelExit, cancelRequested };
    });
  return { completed, requestCancel, isSettled: () => settled };
};

/** Bracket native start/poll/cancel through settlement, including cancellation before Effect consumes the result. */
export const performNativeMetadataOperation = Effect.fn('performNativeMetadataOperation')(
  <A, E, B, E2, R>(
    start: () => Promise<{ readonly pollStatus: () => Promise<A>; readonly cancel: () => Promise<unknown> }>,
    options: vscode.ProgressOptions,
    failure: (cause: unknown) => E,
    use: (
      completed: Awaited<ReturnType<typeof startNativeMetadataOperation<A, E>>['completed']>
    ) => Effect.Effect<B, E2, R>
  ) =>
    Effect.acquireUseRelease(
      Effect.try({ try: () => startNativeMetadataOperation(start, options, failure), catch: failure }),
      native => Effect.promise(() => native.completed).pipe(Effect.flatMap(use)),
      (native, useExit) => {
        const interrupted =
          Exit.isFailure(useExit) && useExit.cause.reasons.some(reason => reason._tag === 'Interrupt');
        if (native.isSettled() && !interrupted) return Effect.void;
        return Effect.sync(() => {
          if (!native.isSettled()) native.requestCancel();
        }).pipe(
          Effect.andThen(Effect.promise(() => native.completed)),
          Effect.flatMap(({ result, cancellation }) => {
            const propagated = Exit.isFailure(useExit) ? useExit.cause.reasons : [];
            const cause = finalizerFailureCause(
              Cause.fromReasons(
                Cause.combine(
                  Exit.isFailure(result) ? result.cause : Cause.empty,
                  Exit.isFailure(cancellation) ? cancellation.cause : Cause.empty
                ).reasons.filter(
                  reason =>
                    !propagated.some(previous =>
                      reason._tag === 'Fail'
                        ? previous._tag === 'Fail' && Object.is(previous.error, reason.error)
                        : reason._tag === 'Die' && previous._tag === 'Die' && previous.defect === reason.defect
                    )
                )
              )
            );
            return cause.reasons.length > 0 ? Effect.failCause(cause) : Effect.void;
          })
        );
      }
    )
);
