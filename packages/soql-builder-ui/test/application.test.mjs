import assert from 'node:assert/strict';
import test from 'node:test';
import * as Effect from 'effect/Effect';
import { SoqlBuilderApplication } from '../out/src/application.js';
import { SOQL_BUILDER_ACTION_EVENT, createInitialSoqlBuilderState } from '../out/src/domain.js';
import { makeFakeSoqlBuilderDriver } from '../out/src/testing/fakeSoqlBuilderDriver.js';

const waitForEffectWork = () => new Promise(resolve => setImmediate(resolve));

test('one application lifecycle owns subscriptions, actions, finalizers, and runtime disposal', async () => {
  const listeners = new Map();
  const initialState = createInitialSoqlBuilderState();
  const view = {
    viewState: initialState,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    }
  };
  const fake = Effect.runSync(makeFakeSoqlBuilderDriver(initialState));
  const application = new SoqlBuilderApplication(view, fake.layer);

  application.connect();
  application.connect();
  await waitForEffectWork();

  const actionListener = listeners.get(SOQL_BUILDER_ACTION_EVENT);
  assert.equal(typeof actionListener, 'function');
  actionListener({
    detail: { _tag: 'ObjectSelected', objectName: 'Account' },
    type: SOQL_BUILDER_ACTION_EVENT
  });
  assert.deepEqual(await Effect.runPromise(fake.nextAction), {
    _tag: 'ObjectSelected',
    objectName: 'Account'
  });
  assert.deepEqual(await Effect.runPromise(fake.recordedActions), [{ _tag: 'ObjectSelected', objectName: 'Account' }]);

  await application.disconnect();
  await application.disconnect();
  assert.equal(listeners.size, 0);
  assert.equal(await Effect.runPromise(fake.isFinalized), true);
});
