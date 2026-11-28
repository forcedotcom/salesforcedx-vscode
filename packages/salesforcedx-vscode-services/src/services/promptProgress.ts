/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { UserCancellationError } from '@salesforce/vscode-services/v2';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as vscode from 'vscode';
import { runInterruptibleWorker } from './interruptibleWorker.js';

/** The native task waits for cleanup; caller Effects never execute through a separate runner. */
const startProgress = (options: vscode.ProgressOptions) => {
  const ready = Deferred.makeUnsafe<{
    readonly progress: vscode.Progress<{ increment?: number; message?: string }>;
    readonly token: vscode.CancellationToken;
  }>();
  const failed = Deferred.makeUnsafe<never>();
  const closed = Deferred.makeUnsafe<void>();
  const completed = Effect.promise(() =>
    Promise.resolve(
      vscode.window.withProgress(options, (progress, token) => {
        Deferred.doneUnsafe(ready, Effect.succeed({ progress, token }));
        return Deferred.await(closed).pipe(Effect.runPromise);
      })
    )
  ).pipe(
    Effect.exit,
    Effect.map(exit => {
      if (Exit.isSuccess(exit)) {
        // A host that closes before starting its task must not leave an acquisition waiting forever.
        Deferred.doneUnsafe(ready, Effect.interrupt);
        return Exit.void;
      }
      Deferred.doneUnsafe(ready, Effect.failCause(exit.cause));
      Deferred.doneUnsafe(failed, Effect.failCause(exit.cause));
      return exit;
    }),
    Effect.runPromise
  );
  return {
    ready,
    failed,
    completed,
    finish: Effect.sync(() => {
      Deferred.doneUnsafe(closed, Effect.void);
    })
  };
};

const closeProgress = <A, E>(native: ReturnType<typeof startProgress>, useExit: Exit.Exit<A, E>) =>
  native.finish.pipe(
    Effect.andThen(Effect.promise(() => native.completed)),
    Effect.flatMap(exit => {
      if (Exit.isSuccess(exit)) return Effect.void;
      // The same host rejection can wake a waiting use and settle the task; report that source once.
      const propagated = Exit.isFailure(useExit) ? useExit.cause.reasons : [];
      const cause = Cause.fromReasons(
        exit.cause.reasons.filter(
          reason =>
            !propagated.some(
              previous => reason._tag === 'Die' && previous._tag === 'Die' && previous.defect === reason.defect
            )
        )
      );
      return cause.reasons.length > 0 ? Effect.failCause(cause) : Effect.void;
    })
  );

const listenForCancellation = (token: vscode.CancellationToken) => {
  const cancelled = Deferred.makeUnsafe<never, UserCancellationError>();
  const listener = token.onCancellationRequested(() => {
    Deferred.doneUnsafe(cancelled, Effect.fail(new UserCancellationError({ message: 'User cancelled progress' })));
  });
  // Register before checking: cancellation can occur while the listener is being installed.
  if (token.isCancellationRequested)
    Deferred.doneUnsafe(cancelled, Effect.fail(new UserCancellationError({ message: 'User cancelled progress' })));
  return { cancelled, listener };
};

export const withProgress =
  (title: string, location: vscode.ProgressLocation = vscode.ProgressLocation.Notification) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.acquireUseRelease(
      Effect.sync(() => startProgress({ title, location, cancellable: false })),
      native => runInterruptibleWorker(self, Deferred.await(native.failed)),
      closeProgress
    );

export const withCancellableProgressReporting =
  (title: string, location: vscode.ProgressLocation = vscode.ProgressLocation.Notification) =>
  <A, E, R>(
    build: (
      progress: vscode.Progress<{ increment?: number; message?: string }>,
      token: vscode.CancellationToken
    ) => Effect.Effect<A, E, R>
  ) =>
    Effect.acquireUseRelease(
      Effect.sync(() => startProgress({ title, location, cancellable: true })),
      native =>
        Deferred.await(native.ready).pipe(
          Effect.flatMap(({ progress, token }) =>
            Effect.acquireUseRelease(
              Effect.sync(() => listenForCancellation(token)),
              cancellation =>
                Deferred.isDoneUnsafe(cancellation.cancelled)
                  ? Deferred.await(cancellation.cancelled)
                  : runInterruptibleWorker(
                      Effect.suspend(() => build(progress, token)),
                      Effect.raceFirst(Deferred.await(cancellation.cancelled), Deferred.await(native.failed))
                    ),
              cancellation =>
                Effect.sync(() => {
                  cancellation.listener.dispose();
                })
            )
          )
        ),
      closeProgress
    );

export const withCancellableProgress =
  (title: string, location: vscode.ProgressLocation = vscode.ProgressLocation.Notification) =>
  <A, E, R>(self: Effect.Effect<A, E, R>) =>
    withCancellableProgressReporting(title, location)(() => self);
