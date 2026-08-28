import assert from 'node:assert/strict';
import test from 'node:test';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import * as Fiber from 'effect/Fiber';
import * as TestClock from 'effect/TestClock';
import * as TestContext from 'effect/TestContext';
import { makeFakeEffectService } from '../out/src/testing/fakeEffectService.js';

const QueryResultsService = Context.GenericTag('@salesforce/soql-builder-ui/test/QueryResultsService');

test('the query-results fake is a scoped Effect layer with deterministic test-clock latency and typed failures', async () => {
  const failure = { _tag: 'QueryResultsFailure', message: 'CSV export failed' };
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const fake = yield* makeFakeEffectService(
        QueryResultsService,
        { returnedCount: 0, title: 'Results' },
        { dispatchLatency: '2 seconds' }
      );

      const serviceResult = yield* Effect.gen(function* () {
        const service = yield* QueryResultsService;
        const initialState = yield* service.initialState;
        const dispatchFiber = yield* service.dispatch({ _tag: 'SaveRequested', format: 'csv' }).pipe(Effect.fork);
        yield* Effect.yieldNow();
        const actionsBeforeTimeAdvances = yield* fake.recordedActions;
        yield* TestClock.adjust('2 seconds');
        yield* Fiber.join(dispatchFiber);
        const queuedAction = yield* fake.nextAction;

        yield* fake.failNextDispatch(failure);
        const failedDispatch = yield* service
          .dispatch({ _tag: 'SaveRequested', format: 'json' })
          .pipe(Effect.either, Effect.fork);
        yield* TestClock.adjust('2 seconds');

        return {
          actions: yield* fake.recordedActions,
          actionsBeforeTimeAdvances,
          failure: yield* Fiber.join(failedDispatch),
          initialState,
          queuedAction
        };
      }).pipe(Effect.provide(fake.layer), Effect.scoped);

      yield* fake.setDispatchLatency(0);
      const actionAfterReconnect = yield* Effect.gen(function* () {
        const service = yield* QueryResultsService;
        const nextAction = yield* fake.nextAction.pipe(Effect.fork);
        yield* service.dispatch({ _tag: 'SaveRequested', format: 'xml' });
        return yield* Fiber.join(nextAction);
      }).pipe(Effect.provide(fake.layer), Effect.scoped);

      return {
        ...serviceResult,
        actionAfterReconnect,
        finalized: yield* fake.isFinalized,
        stats: yield* fake.stats
      };
    }).pipe(Effect.provide(TestContext.TestContext))
  );

  assert.deepEqual(result.initialState, { returnedCount: 0, title: 'Results' });
  assert.deepEqual(result.actionsBeforeTimeAdvances, []);
  assert.deepEqual(result.actions, [{ _tag: 'SaveRequested', format: 'csv' }]);
  assert.deepEqual(result.queuedAction, { _tag: 'SaveRequested', format: 'csv' });
  assert.deepEqual(result.actionAfterReconnect, { _tag: 'SaveRequested', format: 'xml' });
  assert.equal(Either.isLeft(result.failure), true);
  assert.deepEqual(result.failure.left, failure);
  assert.equal(result.finalized, true);
  assert.deepEqual(result.stats, {
    acquisitions: 2,
    activeLayers: 0,
    activeSubscriptions: 0,
    dispatchesInFlight: 0,
    releases: 2
  });
});
