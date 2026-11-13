/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { HostExit, HostReason } from './compatibilityHost.js';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as FiberId from 'effect/FiberId';
import * as Match from 'effect/Match';
import { isUndefined } from 'effect/Predicate';
import * as Ref from 'effect/Ref';

const failureCause = <D, E>(error: D, decode: (data: D) => E): Cause.Cause<E> => {
  try {
    return Cause.fail(decode(error));
  } catch (defect) {
    // Invalid host data is a defect, but must not discard later mixed Cause reasons.
    return Cause.die(defect);
  }
};

const hostCause = <D, E>(reasons: readonly HostReason<D>[], decode: (data: D) => E) =>
  reasons.reduce<Cause.Cause<E>>(
    (cause, reason) =>
      Cause.sequential(
        cause,
        Match.value(reason).pipe(
          Match.tag('Fail', ({ error }) => failureCause(error, decode)),
          Match.tag('Die', ({ defect }) => Cause.die(defect)),
          // V4 has no V3 runtime timestamp. Zero explicitly denotes a synthetic foreign-fiber ID.
          Match.tag('Interrupt', ({ fiberId }) =>
            Cause.interrupt(isUndefined(fiberId) ? FiberId.none : FiberId.runtime(fiberId, 0))
          ),
          Match.exhaustive
        )
      ),
    Cause.empty
  );

export const fromHostExit = <A, D, E>(exit: HostExit<A, D>, decode: (data: D) => E) =>
  exit._tag === 'Success' ? Effect.succeed(exit.value) : Effect.failCause(hostCause(exit.reasons, decode));

export const completeHost = <A, D>(run: () => Promise<HostExit<A, D>>) => {
  const defectExit = (defect: unknown): HostExit<A, D> => ({ _tag: 'Failure', reasons: [{ _tag: 'Die', defect }] });
  try {
    return run().catch(defectExit);
  } catch (defect) {
    // Capture the foreign callback before V3's synchronous-exception tracer can replace its identity.
    return Promise.resolve(defectExit(defect));
  }
};

const startHost = <A, D>(run: (signal: AbortSignal) => Promise<HostExit<A, D>>, signal: AbortSignal) =>
  signal.aborted
    ? Promise.resolve<HostExit<A, D>>({ _tag: 'Failure', reasons: [{ _tag: 'Interrupt', fiberId: undefined }] })
    : completeHost(() => run(signal));

type Operation = { readonly controller: AbortController; readonly finished: Deferred.Deferred<void> };
type BridgeState = { readonly closed: boolean; readonly operations: readonly Operation[] };

/** One V3 bridge admission/cancellation boundary, shared by every typed host operation and lazy query page. */
export const makeLegacyHostOperations = Effect.fn('V3Compatibility.makeHostOperations')(function* () {
  const state = yield* Ref.make<BridgeState>({ closed: false, operations: [] });
  const run = <A, D, E>(start: (signal: AbortSignal) => Promise<HostExit<A, D>>, decode: (data: D) => E) =>
    Effect.uninterruptibleMask(restore =>
      Effect.Do.pipe(
        // AbortSignal is the external Promise protocol; no foreign Effect/Fiber is exposed to V3.
        Effect.bind('controller', () => Effect.sync(() => new AbortController())),
        Effect.bind('finished', () => Deferred.make<void>()),
        Effect.bind('registered', ({ controller, finished }) =>
          Ref.modify(state, current =>
            current.closed
              ? ([false, current] as const)
              : ([true, { ...current, operations: [...current.operations, { controller, finished }] }] as const)
          )
        ),
        Effect.flatMap(({ controller, finished, registered }) =>
          registered
            ? Effect.sync(() => startHost(start, controller.signal)).pipe(
                Effect.flatMap(completion =>
                  restore(
                    Effect.async<HostExit<A, D>>(resume => {
                      completion.then(
                        exit => resume(Effect.succeed(exit)),
                        defect => resume(Effect.die(defect))
                      );
                      return Effect.sync(() => controller.abort());
                    })
                  ).pipe(
                    Effect.exit,
                    Effect.flatMap(waitExit => {
                      if (Exit.isSuccess(waitExit)) return fromHostExit(waitExit.value, decode);
                      if (!Cause.isInterrupted(waitExit.cause)) return Effect.failCause(waitExit.cause);
                      // The outer mask waits for V4 finalizers after V3 cancellation, retaining all failures.
                      return Effect.sync(() => controller.abort()).pipe(
                        Effect.zipRight(Effect.promise(() => completion).pipe(Effect.exit)),
                        Effect.flatMap(hostExit => {
                          if (Exit.isFailure(hostExit))
                            return Effect.failCause(Cause.sequential(waitExit.cause, hostExit.cause));
                          if (hostExit.value._tag === 'Failure') {
                            return Effect.failCause(
                              Cause.sequential(waitExit.cause, hostCause(hostExit.value.reasons, decode))
                            );
                          }
                          return Effect.failCause(waitExit.cause);
                        })
                      );
                    })
                  )
                ),
                Effect.ensuring(
                  Ref.update(state, current => ({
                    ...current,
                    operations: current.operations.filter(operation => operation.controller !== controller)
                  })).pipe(Effect.zipRight(Deferred.succeed(finished, undefined)))
                )
              )
            : Effect.interrupt
        )
      )
    );
  const close = Ref.modify(state, current => [current.operations, { ...current, closed: true }] as const).pipe(
    Effect.flatMap(operations =>
      Effect.forEach(operations, ({ controller }) => Effect.sync(() => controller.abort()), { discard: true }).pipe(
        Effect.zipRight(Effect.forEach(operations, ({ finished }) => Deferred.await(finished), { discard: true }))
      )
    )
  );
  return { run, close, isClosed: Ref.get(state).pipe(Effect.map(current => current.closed)) };
});
