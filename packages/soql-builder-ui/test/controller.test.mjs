import assert from 'node:assert/strict';
import test from 'node:test';
import * as Chunk from 'effect/Chunk';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import { SoqlBuilderMessageChannelError, createInitialSoqlBuilderState } from '../out/src/domain.js';
import { SoqlBuilderController } from '../out/src/effect/soqlBuilderController.js';
import { makeFakeSoqlBuilderService } from '../out/src/testing/fakeSoqlBuilderService.js';

test('the scoped controller streams service state and records actions deterministically', async () => {
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
      const fake = yield* makeFakeSoqlBuilderService(initialState);
      const controllerLayer = SoqlBuilderController.Default.pipe(Layer.provide(fake.layer));

      return yield* Effect.gen(function* () {
        const controller = yield* SoqlBuilderController;
        const subscribed = yield* Deferred.make();
        const stateFiber = yield* controller.states.pipe(
          Stream.tap(() => Deferred.succeed(subscribed, undefined)),
          Stream.take(2),
          Stream.runCollect,
          Effect.fork
        );

        yield* Deferred.await(subscribed);
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
    [undefined, 'Account']
  );
  assert.deepEqual(result.actions, [{ _tag: 'ObjectSelected', objectName: 'Account' }]);
});

test('the fake service propagates typed failures through controller state', async () => {
  const initialState = createInitialSoqlBuilderState();
  const states = await Effect.runPromise(
    Effect.gen(function* () {
      const fake = yield* makeFakeSoqlBuilderService(initialState);
      const controllerLayer = SoqlBuilderController.Default.pipe(Layer.provide(fake.layer));

      return yield* Effect.gen(function* () {
        const controller = yield* SoqlBuilderController;
        const subscribed = yield* Deferred.make();
        const stateFiber = yield* controller.states.pipe(
          Stream.tap(() => Deferred.succeed(subscribed, undefined)),
          Stream.take(2),
          Stream.runCollect,
          Effect.fork
        );
        yield* Deferred.await(subscribed);
        yield* fake.fail(
          new SoqlBuilderMessageChannelError({
            details: 'metadata subscription failed'
          })
        );
        return Chunk.toReadonlyArray(yield* Fiber.join(stateFiber));
      }).pipe(Effect.provide(controllerLayer), Effect.scoped);
    })
  );

  assert.equal(states.at(-1)?.errorMessage, 'metadata subscription failed');
});
