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

const isSoqlBuilderAction = Schema.is(SoqlBuilderActionSchema);

const isSoqlBuilderActionEvent = (event: Event): event is Event & { readonly detail: SoqlBuilderAction } =>
  event.type === SOQL_BUILDER_ACTION_EVENT && 'detail' in event && isSoqlBuilderAction(event.detail);

export class SoqlBuilderApplication {
  private connection: Fiber.RuntimeFiber<void, SoqlBuilderServiceError> | undefined;
  private runtime: ManagedRuntime.ManagedRuntime<SoqlBuilderController, SoqlBuilderServiceError> | undefined;

  constructor(
    private readonly view: SoqlBuilderView,
    private readonly serviceLayer: Layer.Layer<SoqlBuilderService, SoqlBuilderServiceError>
  ) {}

  public readonly connect = (): void => {
    if (this.connection) return;

    const runtime = ManagedRuntime.make(SoqlBuilderController.Default.pipe(Layer.provide(this.serviceLayer)));
    this.runtime = runtime;
    const reportServiceError = (error: SoqlBuilderServiceError): Effect.Effect<void> =>
      Effect.sync(() => {
        this.view.viewState = {
          ...createInitialSoqlBuilderState(),
          errorMessage: error.message
        };
      });
    const connection = runtime.runFork(
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
        Effect.catchTags({
          SoqlBuilderMessageChannelError: reportServiceError,
          SoqlBuilderQueryError: reportServiceError,
          InvalidSoqlBuilderMetadataError: reportServiceError
        })
      )
    );
    this.connection = connection;
    connection.addObserver(() => {
      if (this.connection !== connection) return;
      this.connection = undefined;
      this.runtime = undefined;
      void runtime.dispose().catch(() => {
        // A completed application fiber has no caller to receive teardown failures.
      });
    });
  };

  public readonly disconnect = async (): Promise<void> => {
    const connection = this.connection;
    const runtime = this.runtime;
    this.connection = undefined;
    this.runtime = undefined;
    if (!runtime) return;
    if (connection) await runtime.runPromise(Fiber.interrupt(connection));
    await runtime.dispose();
  };
}
