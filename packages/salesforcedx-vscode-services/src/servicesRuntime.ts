/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { globalLayers } from './servicesLayers';

// DERIVED from layer; cannot drift. Error = Layer.Error (graph build failures).
type ServicesRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<typeof globalLayers>,
  Layer.Layer.Error<typeof globalLayers>
>;

/**
 * Single shared runtime for imperative boundaries (e.g., O11y SpanExporter). Reused to share connection
 * and reauth caches; `Effect.provide(SomeService.Default)` rebuilds the graph on each call.
 */
// eslint-disable-next-line functional/no-let
let servicesRuntime: ServicesRuntime | undefined;

class ServicesRuntimeNotReady extends Data.TaggedError('ServicesRuntimeNotReady')<{}> {}

export const setServicesRuntime = (runtime: ServicesRuntime): void => {
  servicesRuntime = runtime;
};

/**
 * Predicate for imperative boundaries. False → skip runtime-dependent work; post-activation autobatch
 * handles it once true.
 */
export const isServicesRuntimeReady = (): boolean => servicesRuntime !== undefined;

/**
 * Yields shared runtime or fails `ServicesRuntimeNotReady`. MUST NOT retry: runtime published after graph
 * builds (includes tracing SDK); blocking here deadlocks web activation.
 */
export const getServicesRuntime = Effect.fn('getServicesRuntime')(function* () {
  if (!servicesRuntime) {
    return yield* new ServicesRuntimeNotReady();
  }
  return servicesRuntime;
});

/** Dispose the runtime (interrupting in-flight fibers). Call before closing the scope that owns the services. */
export const disposeServicesRuntime = Effect.fn('disposeServicesRuntime')(function* () {
  if (servicesRuntime) {
    yield* servicesRuntime.disposeEffect;
    servicesRuntime = undefined;
  }
});
