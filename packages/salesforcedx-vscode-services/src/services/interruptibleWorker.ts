/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';

/** Race only observers; always join the worker and retain unobserved typed/defect cleanup failures. */
export const runInterruptibleWorker = <A, E, R, StopError>(
  program: Effect.Effect<A, E, R>,
  stop: Effect.Effect<never, StopError>
) =>
  Effect.uninterruptibleMask(restore =>
    Effect.gen(function* () {
      const worker = yield* program.pipe(Effect.interruptible, Effect.forkChild);
      const winner = yield* restore(
        Effect.raceFirst(
          Fiber.await(worker).pipe(Effect.map(exit => ({ _tag: 'Work' as const, exit }))),
          stop.pipe(
            Effect.exit,
            Effect.map(exit => ({ _tag: 'Stop' as const, exit }))
          )
        )
      ).pipe(Effect.exit);
      yield* Fiber.interrupt(worker);
      const workerExit = yield* Fiber.await(worker);
      const outcome: Exit.Exit<A, E | StopError> = Exit.isFailure(winner)
        ? Exit.failCause(winner.cause)
        : winner.value.exit;
      if (Exit.isSuccess(winner) && winner.value._tag === 'Work') return yield* outcome;
      if (Exit.isSuccess(workerExit)) return yield* outcome;
      const cleanupCause = Cause.fromReasons(workerExit.cause.reasons.filter(reason => reason._tag !== 'Interrupt'));
      if (cleanupCause.reasons.length === 0) return yield* outcome;
      // V4 finalizer combination elects typed failures as defects when cleanup fails.
      // Combine explicitly after joining, preserving both the stop error and cleanup reasons.
      return yield* Effect.failCause(
        Exit.isFailure(outcome) ? Cause.combine(outcome.cause, cleanupCause) : cleanupCause
      );
    })
  );
