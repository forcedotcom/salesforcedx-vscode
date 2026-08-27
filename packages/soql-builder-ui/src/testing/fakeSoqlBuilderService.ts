/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderAction, SoqlBuilderServiceError, SoqlBuilderState } from '../domain.js';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  SoqlBuilderService,
  type SoqlBuilderService as SoqlBuilderServiceShape
} from '../effect/soqlBuilderService.js';

type FakeSoqlBuilderService = {
  readonly layer: Layer.Layer<SoqlBuilderService>;
  readonly emit: (state: SoqlBuilderState) => Effect.Effect<void>;
  readonly fail: (error: SoqlBuilderServiceError) => Effect.Effect<boolean>;
  readonly isFinalized: Effect.Effect<boolean>;
  readonly nextAction: Effect.Effect<SoqlBuilderAction>;
  readonly recordedActions: Effect.Effect<readonly SoqlBuilderAction[]>;
};

export const makeFakeSoqlBuilderService = (initialState: SoqlBuilderState) =>
  Effect.gen(function* () {
    const state = yield* SubscriptionRef.make(initialState);
    const actions = yield* Ref.make<readonly SoqlBuilderAction[]>([]);
    const actionQueue = yield* Queue.unbounded<SoqlBuilderAction>();
    const failures = yield* PubSub.unbounded<SoqlBuilderServiceError>();
    const finalized = yield* Ref.make(false);
    const service: SoqlBuilderServiceShape = {
      dispatch: action =>
        Ref.update(actions, current => [...current, action]).pipe(Effect.andThen(Queue.offer(actionQueue, action))),
      initialState: SubscriptionRef.get(state),
      stateChanges: Stream.merge(
        state.changes.pipe(Stream.drop(1)),
        Stream.fromPubSub(failures).pipe(Stream.mapEffect(error => Effect.fail(error)))
      )
    };

    return {
      emit: nextState => SubscriptionRef.set(state, nextState),
      fail: error => PubSub.publish(failures, error),
      isFinalized: Ref.get(finalized),
      layer: Layer.scoped(
        SoqlBuilderService,
        Effect.acquireRelease(Effect.succeed(service), () =>
          Ref.set(finalized, true).pipe(
            Effect.andThen(Queue.shutdown(actionQueue)),
            Effect.andThen(PubSub.shutdown(failures))
          )
        )
      ),
      nextAction: Queue.take(actionQueue),
      recordedActions: Ref.get(actions)
    } satisfies FakeSoqlBuilderService;
  });
