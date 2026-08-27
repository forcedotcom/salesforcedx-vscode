/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SoqlBuilderService } from './effect/soqlBuilderService.js';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Queue from 'effect/Queue';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import {
  SOQL_BUILDER_ACTION_EVENT,
  SoqlBuilderActionSchema,
  createInitialSoqlBuilderState,
  type SoqlBuilderAction,
  type SoqlBuilderServiceError,
  type SoqlBuilderState
} from './domain.js';
import { SoqlBuilderController } from './effect/soqlBuilderController.js';

export type SoqlBuilderView = {
  viewState: SoqlBuilderState;
  readonly addEventListener: (type: string, listener: EventListener) => void;
  readonly removeEventListener: (type: string, listener: EventListener) => void;
};

const SoqlBuilderActionEventSchema = Schema.Struct({
  type: Schema.Literal(SOQL_BUILDER_ACTION_EVENT),
  detail: SoqlBuilderActionSchema
});

const isSoqlBuilderActionEvent = Schema.is(SoqlBuilderActionEventSchema);

export class SoqlBuilderApplication {
  private connection: Fiber.RuntimeFiber<void, SoqlBuilderServiceError> | undefined;
  private disposed = false;
  private readonly runtime: ManagedRuntime.ManagedRuntime<SoqlBuilderController, SoqlBuilderServiceError>;

  constructor(
    private readonly view: SoqlBuilderView,
    serviceLayer: Layer.Layer<SoqlBuilderService, SoqlBuilderServiceError>
  ) {
    this.runtime = ManagedRuntime.make(SoqlBuilderController.Default.pipe(Layer.provide(serviceLayer)));
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
