/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderAction, SoqlBuilderDriverError, SoqlBuilderState } from '../domain.js';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { SoqlBuilderDriver } from './soqlBuilderDriver.js';

export type SoqlBuilderController = {
  readonly states: Stream.Stream<SoqlBuilderState>;
  readonly dispatch: (action: SoqlBuilderAction) => Effect.Effect<void, SoqlBuilderDriverError>;
};

export const SoqlBuilderController = Context.GenericTag<SoqlBuilderController>(
  '@salesforce/soql-builder-ui/controller'
);

const stateWithDriverError = (state: SoqlBuilderState, error: SoqlBuilderDriverError): SoqlBuilderState => ({
  ...state,
  errorMessage: error.message
});

const makeSoqlBuilderController = Effect.gen(function* () {
  const driver = yield* SoqlBuilderDriver;
  const initialState = yield* driver.initialState;
  const state = yield* SubscriptionRef.make(initialState);

  yield* driver.stateChanges.pipe(
    Stream.runForEach(nextState => SubscriptionRef.set(state, nextState)),
    Effect.catchAll(error => SubscriptionRef.update(state, current => stateWithDriverError(current, error))),
    Effect.forkScoped
  );

  return SoqlBuilderController.of({
    dispatch: driver.dispatch,
    states: state.changes
  });
});

export const SoqlBuilderControllerLive = Layer.scoped(SoqlBuilderController, makeSoqlBuilderController);
