/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderServiceError, SoqlBuilderState } from '../domain.js';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { SoqlBuilderService } from './soqlBuilderService.js';

const stateWithServiceError = (state: SoqlBuilderState, error: SoqlBuilderServiceError): SoqlBuilderState => ({
  ...state,
  errorMessage: error.message
});

const makeSoqlBuilderController = Effect.gen(function* () {
  const service = yield* SoqlBuilderService;
  const initialState = yield* service.initialState;
  const state = yield* SubscriptionRef.make(initialState);

  yield* Effect.forkScoped(
    Effect.catch(
      Stream.runForEach(service.stateChanges, nextState => SubscriptionRef.set(state, nextState)),
      error => SubscriptionRef.update(state, current => stateWithServiceError(current, error))
    )
  );
  yield* Effect.yieldNow;

  return {
    dispatch: service.dispatch,
    states: SubscriptionRef.changes(state)
  };
});

export class SoqlBuilderController extends Context.Service<
  SoqlBuilderController,
  Effect.Success<typeof makeSoqlBuilderController>
>()('@salesforce/soql-builder-ui/controller') {
  public static readonly layer = Layer.effect(SoqlBuilderController, makeSoqlBuilderController);
}
