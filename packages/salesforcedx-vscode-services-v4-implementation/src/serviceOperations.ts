/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Ref from 'effect/Ref';
import { finalizerFailureCause } from './scopedFiber.js';

/** Admission belongs to service instances, including calls run by consumer-owned V4 runtimes. */
export class ServiceOperations extends Context.Service<
  ServiceOperations,
  {
    readonly run: <A, E, R, Args extends readonly unknown[]>(
      program: Effect.Effect<A, E, R>,
      ...args: Args
    ) => Effect.Effect<A, E, R>;
    readonly close: Effect.Effect<void>;
  }
>()('@salesforce/vscode-services-v4-implementation/ServiceOperations') {}

export const ServiceOperationsLayer = Layer.effect(
  ServiceOperations,
  Effect.gen(function* () {
    const state = yield* Ref.make<{
      readonly closed: boolean;
      readonly fibers: readonly Fiber.Fiber<unknown, unknown>[];
    }>({ closed: false, fibers: [] });
    const run = <A, E, R>(program: Effect.Effect<A, E, R>, ..._args: readonly unknown[]): Effect.Effect<A, E, R> =>
      Effect.uninterruptibleMask(restore =>
        Effect.withFiber(caller =>
          Ref.get(state).pipe(
            Effect.flatMap(current => {
              if (current.fibers.includes(caller)) return restore(program);
              if (current.closed) return Effect.interrupt;
              return Effect.gen(function* () {
                const started = yield* Deferred.make<void>();
                // Only the service operation belongs to this child; caller-owned cleanup stays outside it.
                const child = yield* Deferred.await(started).pipe(
                  Effect.andThen(restore(program)),
                  Effect.onExit(() =>
                    Effect.withFiber(fiber =>
                      Ref.update(state, value => ({
                        ...value,
                        fibers: value.fibers.filter(existing => existing !== fiber)
                      }))
                    )
                  ),
                  Effect.forkChild
                );
                const admitted = yield* Ref.modify(state, value =>
                  value.closed
                    ? ([false, value] as const)
                    : ([true, { ...value, fibers: [...value.fibers, child] }] as const)
                );
                if (!admitted) {
                  yield* Fiber.interrupt(child);
                  return yield* Effect.interrupt;
                }
                yield* Deferred.succeed(started, undefined);
                // await returns the child's Exit as data, distinguishing caller cancellation from child failure.
                const waiting = yield* restore(Fiber.await(child)).pipe(Effect.exit);
                if (Exit.isSuccess(waiting)) return yield* waiting.value;
                const stopped = yield* Fiber.interrupt(child).pipe(Effect.andThen(Fiber.await(child)));
                return yield* Effect.failCause(
                  Cause.combine(
                    waiting.cause,
                    Cause.fromReasons(
                      Exit.isFailure(stopped) ? stopped.cause.reasons.filter(reason => reason._tag !== 'Interrupt') : []
                    )
                  )
                );
              });
            })
          )
        )
      );
    const close = Effect.withFiber(disposingFiber =>
      Ref.modify(state, current => [current.fibers, { ...current, closed: true }] as const).pipe(
        Effect.flatMap(fibers =>
          Effect.forEach(
            fibers.filter(fiber => fiber !== disposingFiber),
            fiber => Fiber.interrupt(fiber).pipe(Effect.andThen(Fiber.await(fiber))),
            { concurrency: 'unbounded' }
          )
        ),
        Effect.flatMap(exits => {
          const cause = finalizerFailureCause(
            Cause.fromReasons(exits.flatMap(exit => (Exit.isFailure(exit) ? exit.cause.reasons : [])))
          );
          return cause.reasons.length > 0 ? Effect.failCause(cause) : Effect.void;
        })
      )
    ).pipe(Effect.uninterruptible);
    yield* Effect.addFinalizer(() => close);
    return ServiceOperations.of({ run, close });
  })
);
