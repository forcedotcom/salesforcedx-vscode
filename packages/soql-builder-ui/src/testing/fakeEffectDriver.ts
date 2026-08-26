/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as Context from 'effect/Context';
import type * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Queue from 'effect/Queue';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';

export type EffectDriver<State, Action, Failure> = {
  readonly initialState: Effect.Effect<State, Failure>;
  readonly stateChanges: Stream.Stream<State, Failure>;
  readonly dispatch: (action: Action) => Effect.Effect<void, Failure>;
};

export type FakeEffectDriverStats = {
  readonly acquisitions: number;
  readonly activeLayers: number;
  readonly activeSubscriptions: number;
  readonly dispatchesInFlight: number;
  readonly releases: number;
};

export type FakeEffectDriver<Identifier, State, Action, Failure> = {
  readonly layer: Layer.Layer<Identifier>;
  readonly emit: (state: State) => Effect.Effect<void>;
  readonly fail: (error: Failure) => Effect.Effect<boolean>;
  readonly failNextDispatch: (error: Failure) => Effect.Effect<void>;
  readonly isFinalized: Effect.Effect<boolean>;
  readonly nextAction: Effect.Effect<Action>;
  readonly recordedActions: Effect.Effect<readonly Action[]>;
  readonly setDispatchLatency: (latency: Duration.DurationInput) => Effect.Effect<void>;
  readonly stats: Effect.Effect<FakeEffectDriverStats>;
};

const initialStats: FakeEffectDriverStats = {
  acquisitions: 0,
  activeLayers: 0,
  activeSubscriptions: 0,
  dispatchesInFlight: 0,
  releases: 0
};

export const makeFakeEffectDriver = <Identifier, State, Action, Failure>(
  tag: Context.Tag<Identifier, EffectDriver<State, Action, Failure>>,
  initialState: State,
  options: { readonly dispatchLatency?: Duration.DurationInput } = {}
) =>
  Effect.gen(function* () {
    const state = yield* SubscriptionRef.make(initialState);
    const actions = yield* Ref.make<readonly Action[]>([]);
    const actionQueue = yield* Queue.unbounded<Action>();
    const failures = yield* PubSub.unbounded<Failure>();
    const dispatchFailure = yield* Ref.make<Option.Option<Failure>>(Option.none());
    const dispatchLatency = yield* Ref.make<Duration.DurationInput>(options.dispatchLatency ?? 0);
    const stats = yield* Ref.make(initialStats);
    const stateChanges = Stream.merge(
      state.changes.pipe(Stream.drop(1)),
      Stream.fromPubSub(failures).pipe(Stream.mapEffect(error => Effect.fail(error)))
    );
    const service: EffectDriver<State, Action, Failure> = {
      dispatch: Effect.fn('FakeEffectDriver.dispatch')(
        function* (action: Action) {
          yield* Ref.update(stats, current => ({
            ...current,
            dispatchesInFlight: current.dispatchesInFlight + 1
          }));
          const latency = yield* Ref.get(dispatchLatency);
          yield* Effect.sleep(latency);
          const failure = yield* Ref.getAndSet(dispatchFailure, Option.none());
          if (Option.isSome(failure)) yield* Effect.fail(failure.value);
          yield* Ref.update(actions, current => [...current, action]);
          yield* Queue.offer(actionQueue, action);
        },
        Effect.ensuring(
          Ref.update(stats, current => ({
            ...current,
            dispatchesInFlight: current.dispatchesInFlight - 1
          }))
        )
      ),
      initialState: SubscriptionRef.get(state),
      stateChanges: Stream.unwrap(
        Ref.update(stats, current => ({
          ...current,
          activeSubscriptions: current.activeSubscriptions + 1
        })).pipe(
          Effect.as(
            stateChanges.pipe(
              Stream.ensuring(
                Ref.update(stats, current => ({
                  ...current,
                  activeSubscriptions: current.activeSubscriptions - 1
                }))
              )
            )
          )
        )
      )
    };

    return {
      emit: (nextState: State) => SubscriptionRef.set(state, nextState),
      fail: (error: Failure) => PubSub.publish(failures, error),
      failNextDispatch: (error: Failure) => Ref.set(dispatchFailure, Option.some(error)),
      isFinalized: Ref.get(stats).pipe(
        Effect.map(
          current =>
            current.acquisitions > 0 &&
            current.activeLayers === 0 &&
            current.activeSubscriptions === 0 &&
            current.dispatchesInFlight === 0 &&
            current.releases === current.acquisitions
        )
      ),
      layer: Layer.scoped(
        tag,
        Effect.acquireRelease(
          Ref.update(stats, current => ({
            ...current,
            acquisitions: current.acquisitions + 1,
            activeLayers: current.activeLayers + 1
          })).pipe(Effect.as(service)),
          () =>
            Ref.update(stats, current => ({
              ...current,
              activeLayers: current.activeLayers - 1,
              releases: current.releases + 1
            })).pipe(Effect.andThen(Queue.shutdown(actionQueue)), Effect.andThen(PubSub.shutdown(failures)))
        )
      ),
      nextAction: Queue.take(actionQueue),
      recordedActions: Ref.get(actions),
      setDispatchLatency: (latency: Duration.DurationInput) => Ref.set(dispatchLatency, latency),
      stats: Ref.get(stats)
    };
  });
