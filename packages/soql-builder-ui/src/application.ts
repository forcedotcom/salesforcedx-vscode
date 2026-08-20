/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderDriver } from './effect/soqlBuilderDriver.js';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Queue from 'effect/Queue';
import * as Stream from 'effect/Stream';
import {
  SOQL_BUILDER_ACTION_EVENT,
  createInitialSoqlBuilderState,
  type SoqlBuilderAction,
  type SoqlBuilderDriverError,
  type SoqlBuilderState
} from './domain.js';
import { SoqlBuilderController, SoqlBuilderControllerLive } from './effect/soqlBuilderController.js';

export type SoqlBuilderView = {
  viewState: SoqlBuilderState;
  readonly addEventListener: (type: string, listener: EventListener) => void;
  readonly removeEventListener: (type: string, listener: EventListener) => void;
};

type SoqlBuilderActionEvent = Event & {
  readonly detail: SoqlBuilderAction;
};

const isSoqlBuilderActionEvent = (event: Event): event is SoqlBuilderActionEvent =>
  event.type === SOQL_BUILDER_ACTION_EVENT && 'detail' in event;

export class SoqlBuilderApplication {
  private connection: Fiber.RuntimeFiber<void, SoqlBuilderDriverError> | undefined;
  private disposed = false;
  private readonly runtime: ManagedRuntime.ManagedRuntime<SoqlBuilderController, SoqlBuilderDriverError>;

  constructor(
    private readonly view: SoqlBuilderView,
    driverLayer: Layer.Layer<SoqlBuilderDriver, SoqlBuilderDriverError>
  ) {
    this.runtime = ManagedRuntime.make(SoqlBuilderControllerLive.pipe(Layer.provide(driverLayer)));
  }

  public readonly connect = (): void => {
    if (this.connection || this.disposed) return;

    this.connection = this.runtime.runFork(
      Effect.gen(this, function* () {
        const controller = yield* SoqlBuilderController;
        const actions = yield* Queue.unbounded<SoqlBuilderAction>();
        const actionListener: EventListener = event => {
          if (isSoqlBuilderActionEvent(event)) actions.unsafeOffer(event.detail);
        };

        this.view.addEventListener(SOQL_BUILDER_ACTION_EVENT, actionListener);
        yield* Effect.addFinalizer(() =>
          Effect.sync(() => this.view.removeEventListener(SOQL_BUILDER_ACTION_EVENT, actionListener)).pipe(
            Effect.andThen(Queue.shutdown(actions))
          )
        );

        yield* Effect.all(
          [
            controller.states.pipe(
              Stream.runForEach(state =>
                Effect.sync(() => {
                  this.view.viewState = state;
                })
              )
            ),
            Stream.fromQueue(actions).pipe(Stream.runForEach(controller.dispatch))
          ],
          { concurrency: 'unbounded', discard: true }
        );
      }).pipe(
        Effect.scoped,
        Effect.catchAll(error =>
          Effect.sync(() => {
            this.view.viewState = {
              ...createInitialSoqlBuilderState(),
              errorMessage: error.message
            };
          })
        )
      )
    );
  };

  public readonly disconnect = async (): Promise<void> => {
    if (this.disposed) return;
    this.disposed = true;

    const connection = this.connection;
    this.connection = undefined;
    if (connection) await this.runtime.runPromise(Fiber.interrupt(connection));
    await this.runtime.dispose();
  };
}
