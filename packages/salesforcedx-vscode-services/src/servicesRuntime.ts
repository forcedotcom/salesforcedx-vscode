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

// Runtime type DERIVED from the layer that builds the services — never hand-listed, so it can't drift
// from what activation actually provides. Error channel is Layer.Error (what building the graph can fail with).
type ServicesRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<typeof globalLayers>,
  Layer.Layer.Error<typeof globalLayers>
>;

/**
 * A ManagedRuntime over the single service context built during activation, for callers that live at an
 * imperative VS Code boundary (e.g. the O11y SpanExporter class) and can't `yield*` into the built context
 * directly. Reusing this runtime gives them the ONE shared service instances — same connection and reauth
 * caches — instead of `Effect.provide(SomeService.Default)`, which rebuilds the service graph (a fresh,
 * private instance) on every call. Set from activation once the context is built.
 */
// eslint-disable-next-line functional/no-let
let servicesRuntime: ServicesRuntime | undefined;

class ServicesRuntimeNotReady extends Data.TaggedError('ServicesRuntimeNotReady')<{}> {}

export const setServicesRuntime = (runtime: ServicesRuntime): void => {
  servicesRuntime = runtime;
};

/**
 * Yields the shared services runtime, or fails `ServicesRuntimeNotReady` if activation hasn't set it yet.
 * Callers retry (the runtime is set once, early in activation) — see O11ySpanExporter.
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
