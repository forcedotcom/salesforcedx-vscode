import assert from 'node:assert/strict';
import test from 'node:test';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import { createInitialSoqlBuilderState } from '../out/src/domain.js';
import { SoqlBuilderController, SoqlBuilderControllerLive } from '../out/src/effect/soqlBuilderController.js';
import { makeFakeSoqlBuilderDriver } from '../out/src/testing/fakeSoqlBuilderDriver.js';

test('the scoped controller streams driver state and records actions deterministically', async () => {
  const initialState = createInitialSoqlBuilderState();
  const nextState = {
    ...initialState,
    query: {
      ...initialState.query,
      sObject: 'Account'
    }
  };

  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const fake = yield* makeFakeSoqlBuilderDriver(initialState);
      const controllerLayer = SoqlBuilderControllerLive.pipe(Layer.provide(fake.layer));

      return yield* Effect.gen(function* () {
        const controller = yield* SoqlBuilderController;
        const stateFiber = yield* controller.states.pipe(Stream.take(2), Stream.runCollect, Effect.fork);

        yield* Effect.sleep(Duration.millis(10));
        yield* fake.emit(nextState);
        yield* controller.dispatch({ _tag: 'ObjectSelected', objectName: 'Account' });

        return {
          actions: yield* fake.recordedActions,
          states: Chunk.toReadonlyArray(yield* Fiber.join(stateFiber))
        };
      }).pipe(Effect.provide(controllerLayer), Effect.scoped);
    })
  );

  assert.deepEqual(
    result.states.map(state => state.query.sObject),
    ['', 'Account']
  );
  assert.deepEqual(result.actions, [{ _tag: 'ObjectSelected', objectName: 'Account' }]);
});
