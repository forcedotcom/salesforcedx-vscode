/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Scope from 'effect/Scope';
import { finalizerFailureCause, makeScopedFibers } from '../../src/scopedFiber.js';

it('does not retain per-fiber finalizers after successful background work completes', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      const fibers = yield* makeScopedFibers.pipe(Scope.provide(scope));
      const count = () =>
        scope.state._tag === 'Open'
          ? Number(scope.state.finalizer !== undefined) + (scope.state.finalizers?.size ?? 0)
          : 0;
      const initial = count();
      yield* Effect.forEach(Array.from({ length: 100 }), () =>
        fibers.fork(Effect.void).pipe(Effect.flatMap(Fiber.join))
      );
      expect(count()).toBe(initial);
      expect(initial).toBe(1);
      yield* Scope.close(scope, Exit.void);
    })
  );
});

it('preserves every mixed cleanup reason, payload identity and annotations when making failures fatal', () => {
  const failure = new Error('typed cleanup failure');
  const defect = new Error('opaque cleanup defect');
  const cause = Cause.fromReasons([
    Cause.makeFailReason(failure).annotate(Context.makeUnsafe(new Map([['fixture', 'annotation']]))),
    ...Cause.interrupt(7).reasons,
    Cause.makeDieReason(defect)
  ]);
  const result = finalizerFailureCause(cause);
  expect(result.reasons.map(reason => reason._tag)).toEqual(['Die', 'Interrupt', 'Die']);
  expect(result.reasons[0]._tag === 'Die' && result.reasons[0].defect).toBe(failure);
  expect(result.reasons[0].annotations.get('fixture')).toBe('annotation');
  expect(result.reasons[2]._tag === 'Die' && result.reasons[2].defect).toBe(defect);
  expect(finalizerFailureCause(Cause.interrupt(7)).reasons).toHaveLength(0);
});
