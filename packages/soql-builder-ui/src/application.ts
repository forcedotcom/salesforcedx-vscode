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

const makeSessionLayer = (serviceLayer: Layer.Layer<SoqlBuilderService, SoqlBuilderServiceError>) =>
  SoqlBuilderController.layer.pipe(Layer.provide(serviceLayer));
type SessionLayer = ReturnType<typeof makeSessionLayer>;
type SessionRuntime = ManagedRuntime.ManagedRuntime<Layer.Success<SessionLayer>, Layer.Error<SessionLayer>>;

const isSoqlBuilderAction = Schema.is(SoqlBuilderActionSchema);

const isSoqlBuilderActionEvent = (event: Event): event is Event & { readonly detail: SoqlBuilderAction } =>
  event.type === SOQL_BUILDER_ACTION_EVENT && 'detail' in event && isSoqlBuilderAction(event.detail);

export class SoqlBuilderApplication {
  private sessionFiber: Fiber.Fiber<unknown, unknown> | undefined;
  private sessionRuntime: SessionRuntime | undefined;
  private sessionCleanup: Promise<void> | undefined;

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
    const view = this.view;
    const actions = Effect.runSync(Queue.unbounded<SoqlBuilderAction>());
    const actionListener: EventListener = event => {
      if (isSoqlBuilderActionEvent(event)) Queue.offerUnsafe(actions, event.detail);
    };
    view.addEventListener(SOQL_BUILDER_ACTION_EVENT, actionListener);
    const runtime = ManagedRuntime.make(this.serviceLayer.pipe(makeSessionLayer));
    this.sessionRuntime = runtime;
    const session = Effect.gen(function* () {
      const controller = yield* SoqlBuilderController;
      yield* Effect.all(
        [
          controller.states.pipe(
            Stream.runForEach(state =>
              Effect.sync(() => {
                view.viewState = state;
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
        InvalidSoqlBuilderMetadataError: reportServiceError,
        SoqlBuilderMessageChannelError: reportServiceError,
        SoqlBuilderQueryError: reportServiceError
      }),
      Effect.ensuring(
        Effect.sync(() => view.removeEventListener(SOQL_BUILDER_ACTION_EVENT, actionListener)).pipe(
          Effect.andThen(Queue.shutdown(actions))
        )
      )
    );
    const sessionFiber = runtime.runFork(Effect.yieldNow.pipe(Effect.andThen(session)));
    this.sessionFiber = sessionFiber;
    this.sessionCleanup = sessionFiber.pipe(
      Fiber.await,
      Effect.andThen(Effect.promise(() => runtime.dispose())),
      Effect.tap(() =>
        Effect.sync(() => {
          if (this.sessionFiber === sessionFiber) this.sessionFiber = undefined;
          if (this.sessionRuntime === runtime) this.sessionRuntime = undefined;
        })
      ),
      Effect.runPromise
    );
  };

  public readonly disconnect = async (): Promise<void> => {
    const sessionFiber = this.sessionFiber;
    if (sessionFiber) await sessionFiber.pipe(Fiber.interrupt, Effect.runPromise);
    await this.sessionCleanup;
  };
}
