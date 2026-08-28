/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderServiceError, SoqlBuilderState } from '../domain.js';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { SoqlBuilderService } from './soqlBuilderService.js';

const stateWithServiceError = (state: SoqlBuilderState, error: SoqlBuilderServiceError): SoqlBuilderState => ({
  ...state,
  errorMessage: error.message
});

export class SoqlBuilderController extends Effect.Service<SoqlBuilderController>()(
  '@salesforce/soql-builder-ui/controller',
  {
    accessors: true,
    scoped: Effect.gen(function* () {
      const service = yield* SoqlBuilderService;
      const initialState = yield* service.initialState;
      const state = yield* SubscriptionRef.make(initialState);

      yield* service.stateChanges.pipe(
        Stream.runForEach(nextState => SubscriptionRef.set(state, nextState)),
        Effect.catchAll(error => SubscriptionRef.update(state, current => stateWithServiceError(current, error))),
        Effect.forkScoped
      );

      return {
        dispatch: service.dispatch,
        states: state.changes
      };
    })
  }
) {}
