/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Ref from 'effect/Ref';

/** Retain mixed cleanup Causes in order; only pure shutdown interruption is ignored. */
export const finalizerFailureCause = <E>(cause: Cause.Cause<E>): Cause.Cause<never> =>
  cause.reasons.every(reason => reason._tag === 'Interrupt')
    ? Cause.empty
    : Cause.fromReasons(
        cause.reasons.map(reason =>
          reason._tag === 'Fail'
            ? Cause.makeDieReason(reason.error).annotate(Context.makeUnsafe(reason.annotations))
            : reason
        )
      );

/** Requires a sequential owning scope (Layer's default); native forkIn registers/removes children atomically. */
export const makeScopedFibers = Effect.gen(function* () {
  const scope = yield* Effect.scope;
  const failures = yield* Ref.make<Cause.Cause<never>>(Cause.empty);
  // Registered before child finalizers: they finish and record their exits before this runs.
  yield* Effect.addFinalizer(() =>
    Ref.get(failures).pipe(Effect.flatMap(cause => (cause.reasons.length > 0 ? Effect.failCause(cause) : Effect.void)))
  );
  return {
    fork: <A, E, R>(program: Effect.Effect<A, E, R>) =>
      Effect.forkIn(
        program.pipe(
          Effect.onExit(exit => {
            if (Exit.isSuccess(exit)) return Effect.void;
            const cause = finalizerFailureCause(exit.cause);
            return cause.reasons.length > 0
              ? Ref.update(failures, current => Cause.combine(current, cause))
              : Effect.void;
          })
        ),
        scope
      )
  };
});
