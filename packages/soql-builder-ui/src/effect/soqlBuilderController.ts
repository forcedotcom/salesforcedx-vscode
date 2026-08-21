/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderAction, SoqlBuilderServiceError, SoqlBuilderState } from '../domain.js';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { SoqlBuilderService } from './soqlBuilderService.js';

export type SoqlBuilderController = {
  readonly states: Stream.Stream<SoqlBuilderState>;
  readonly dispatch: (action: SoqlBuilderAction) => Effect.Effect<void, SoqlBuilderServiceError>;
};

export const SoqlBuilderController = Context.GenericTag<SoqlBuilderController>(
  '@salesforce/soql-builder-ui/controller'
);

const stateWithServiceError = (state: SoqlBuilderState, error: SoqlBuilderServiceError): SoqlBuilderState => ({
  ...state,
  errorMessage: error.message
});

const makeSoqlBuilderController = Effect.gen(function* () {
  const service = yield* SoqlBuilderService;
  const initialState = yield* service.initialState;
  const state = yield* SubscriptionRef.make(initialState);

  yield* service.stateChanges.pipe(
    Stream.runForEach(nextState => SubscriptionRef.set(state, nextState)),
    Effect.catchTag('SoqlBuilderServiceError', error =>
      SubscriptionRef.update(state, current => stateWithServiceError(current, error))
    ),
    Effect.forkScoped
  );

  return SoqlBuilderController.of({
    dispatch: service.dispatch,
    states: state.changes
  });
});

export const SoqlBuilderControllerLive = Layer.scoped(SoqlBuilderController, makeSoqlBuilderController);
