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
  private sessionFiber: Fiber.RuntimeFiber<void, never> | undefined;

  constructor(
    private readonly view: SoqlBuilderView,
    private readonly serviceLayer: Layer.Layer<SoqlBuilderService, SoqlBuilderServiceError>
  ) {}

  public readonly connect = (): void => {
    if (this.sessionFiber) return;

    const reportServiceError = (error: SoqlBuilderServiceError): Effect.Effect<void> =>
      Effect.sync(() => {
        this.view.viewState = {
          ...createInitialSoqlBuilderState(),
          errorMessage: error.message
        };
      });
    const session = Effect.gen(this, function* () {
      const controller = yield* SoqlBuilderController;
      const actions = yield* Queue.unbounded<SoqlBuilderAction>();
      const actionListener: EventListener = event => {
        if (isSoqlBuilderActionEvent(event)) actions.unsafeOffer(event.detail);
      };

      yield* Effect.acquireRelease(
        Effect.sync(() => this.view.addEventListener(SOQL_BUILDER_ACTION_EVENT, actionListener)),
        () =>
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
      Effect.provide(SoqlBuilderController.Default.pipe(Layer.provide(this.serviceLayer))),
      Effect.scoped,
      Effect.catchTags({
        InvalidSoqlBuilderMetadataError: reportServiceError,
        SoqlBuilderMessageChannelError: reportServiceError,
        SoqlBuilderQueryError: reportServiceError
      })
    );
    const sessionFiber = Effect.yieldNow().pipe(
      Effect.andThen(session),
      Effect.ensuring(
        Effect.sync(() => {
          if (this.sessionFiber === sessionFiber) this.sessionFiber = undefined;
        })
      ),
      Effect.runFork
    );
    this.sessionFiber = sessionFiber;
  };

  public readonly disconnect = async (): Promise<void> => {
    const sessionFiber = this.sessionFiber;
    this.sessionFiber = undefined;
    if (sessionFiber) await sessionFiber.pipe(Fiber.interrupt, Effect.runPromise);
  };
}
