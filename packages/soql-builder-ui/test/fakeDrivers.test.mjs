import assert from 'node:assert/strict';
import test from 'node:test';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import * as Fiber from 'effect/Fiber';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import { makeFakeQueryResultsDriver } from '../out/src/testing/fakeQueryResultsDriver.js';

const QueryResultsDriver = Context.GenericTag('@salesforce/soql-builder-ui/test/QueryResultsDriver');

test('the query-results fake is a scoped Effect layer with deterministic test-clock latency and typed failures', async () => {
  const failure = { _tag: 'QueryResultsFailure', message: 'CSV export failed' };
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const fake = yield* makeFakeQueryResultsDriver(
        QueryResultsDriver,
        { returnedCount: 0, title: 'Results' },
        { dispatchLatency: '2 seconds' }
      );

      const driverResult = yield* Effect.gen(function* () {
        const driver = yield* QueryResultsDriver;
        const initialState = yield* driver.initialState;
        const dispatchFiber = yield* driver.dispatch({ _tag: 'SaveRequested', format: 'csv' }).pipe(Effect.fork);
        yield* Effect.yieldNow();
        const actionsBeforeTimeAdvances = yield* fake.recordedActions;
        yield* TestClock.adjust('2 seconds');
        yield* Fiber.join(dispatchFiber);

        yield* fake.failNextDispatch(failure);
        const failedDispatch = yield* driver
          .dispatch({ _tag: 'SaveRequested', format: 'json' })
          .pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('2 seconds');

        return {
          actions: yield* fake.recordedActions,
          actionsBeforeTimeAdvances,
          failure: yield* Fiber.join(failedDispatch),
          initialState
        };
      }).pipe(Effect.provide(fake.layer), Effect.scoped);

      return {
        ...driverResult,
        finalized: yield* fake.isFinalized,
        stats: yield* fake.stats
      };
    }).pipe(Effect.provide(TestContext.TestContext))
  );

  assert.deepEqual(result.initialState, { returnedCount: 0, title: 'Results' });
  assert.deepEqual(result.actionsBeforeTimeAdvances, []);
  assert.deepEqual(result.actions, [{ _tag: 'SaveRequested', format: 'csv' }]);
  assert.equal(Either.isLeft(result.failure), true);
  assert.deepEqual(result.failure.left, failure);
  assert.equal(result.finalized, true);
  assert.deepEqual(result.stats, {
    acquisitions: 1,
    activeLayers: 0,
    activeSubscriptions: 0,
    dispatchesInFlight: 0,
    releases: 1
  });
});
