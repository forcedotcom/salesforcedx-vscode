/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';

/**
 * Advances the org generation so metadata requests started for the previous org become stale.
 * The caller increments this before notifying the UI that the default org changed.
 */
export const invalidateMetadataRequests = (generation: Ref.Ref<number>) =>
  Ref.update(generation, current => current + 1);

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
 * infers that combined type; it is intentionally not written explicitly.
 */
export const runForCurrentMetadataGeneration = <A, E, R, B, E2, R2>(
  generation: Ref.Ref<number>,
  request: Effect.Effect<A, E, R>,
  publish: (value: A) => Effect.Effect<B, E2, R2>
) =>
  Effect.gen(function* () {
    // Snapshot before starting the asynchronous request. An org change increments the shared Ref.
    const requestGeneration = yield* Ref.get(generation);
    const value = yield* request;
    const currentGeneration = yield* Ref.get(generation);
    // Silently discard a response from an earlier org instead of publishing it to the webview.
    if (requestGeneration === currentGeneration) return yield* publish(value);
  });
