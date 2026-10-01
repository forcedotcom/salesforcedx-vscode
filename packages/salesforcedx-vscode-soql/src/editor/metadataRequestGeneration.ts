/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Ref from 'effect/Ref';

type MetadataRequestGenerationGate = {
  readonly generation: Ref.Ref<number>;
  readonly semaphore: Effect.Semaphore;
};

/**
 * Per-editor synchronization state for metadata requests.
 *
 * The service stays in Effect's context instead of being threaded through request handlers as a
 * mutable implementation detail. Each editor provides its own layer, so an org change only
 * invalidates metadata work owned by that editor.
 */
const MetadataRequestGenerationGate = Context.GenericTag<MetadataRequestGenerationGate>(
  'SOQLEditor/MetadataRequestGenerationGate'
);

export const MetadataRequestGenerationGateLive = Layer.effect(
  MetadataRequestGenerationGate,
  Effect.gen(function* () {
    return {
      generation: yield* Ref.make(0),
      semaphore: yield* Effect.makeSemaphore(1)
    };
  })
);

/**
 * Advances the org generation so metadata requests started for the previous org become stale.
 * The increment and the UI notification share the same permit as conditional publication, making
 * their ordering atomic from the webview's perspective.
 */
export const invalidateMetadataRequests = Effect.fn('MetadataRequestGeneration.invalidateMetadataRequests')(function* <
  A,
  E,
  R
>(notifyUi: Effect.Effect<A, E, R>) {
  const gate = yield* MetadataRequestGenerationGate;
  return yield* gate.semaphore.withPermits(1)(
    Ref.update(gate.generation, current => current + 1).pipe(Effect.andThen(notifyUi))
  );
});

/**
 * Publishes a metadata response only if the active org did not change while the request was running.
 *
 * Effect's type parameters are `Effect<Success, Error, Requirements>`. This helper composes two
 * independently typed Effects, so each stage contributes one set of those parameters:
 *
 * - `A`, `E`, `R`: the request's success value, error, and required services.
 * - `B`, `E2`, `R2`: the publisher's success value, error, and required services.
 *
 * The resulting Effect therefore succeeds with `B` when the response is current, or `void` when an
 * org change made it stale. Its error and service channels are the unions from both stages. TypeScript
 * infers that combined type, plus the internal gate requirement supplied once per editor by
 * `MetadataRequestGenerationGateLive`; it is intentionally not written explicitly.
 */
export const runForCurrentMetadataGeneration = Effect.fn('MetadataRequestGeneration.runForCurrentMetadataGeneration')(
  function* <A, E, R, B, E2, R2>(request: Effect.Effect<A, E, R>, publish: (value: A) => Effect.Effect<B, E2, R2>) {
    const gate = yield* MetadataRequestGenerationGate;
    // Snapshot before starting the asynchronous request. An org change increments the shared Ref.
    const requestGeneration = yield* Ref.get(gate.generation);
    const value = yield* request;

    return yield* gate.semaphore.withPermits(1)(
      Effect.gen(function* () {
        const currentGeneration = yield* Ref.get(gate.generation);
        // Silently discard a response from an earlier org instead of publishing it to the webview.
        if (requestGeneration === currentGeneration) return yield* publish(value);
      })
    );
  }
);
