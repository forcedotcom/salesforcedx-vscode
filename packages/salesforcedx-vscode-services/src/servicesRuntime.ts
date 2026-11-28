/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type ChannelService, type ConnectionService, type TargetOrgRef } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import type * as Layer from 'effect/Layer';
import type * as ManagedRuntime from 'effect/ManagedRuntime';
import type * as OtlpExporter from 'effect/observability/OtlpExporter';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { type catalogProviderLayers } from './services/catalogLayers';

/** Minimum V4 context required by imperative exporter and legacy telemetry boundaries. */
type ServicesRuntime = ManagedRuntime.ManagedRuntime<
  ChannelService | ConnectionService | TargetOrgRef | OtlpExporter.Flusher,
  Layer.Error<typeof catalogProviderLayers>
>;

/**
 * Single shared runtime for imperative boundaries (e.g., O11y SpanExporter). Reused to share connection
 * and reauth caches; providing an individual service layer per call rebuilds its graph.
 */
// eslint-disable-next-line functional/no-let
let servicesRuntime: ServicesRuntime | undefined;

class ServicesRuntimeNotReady extends Schema.TaggedError<ServicesRuntimeNotReady>()('ServicesRuntimeNotReady', {
  message: Schema.String
}) {}

export const setServicesRuntime = (runtime: ServicesRuntime): void => {
  servicesRuntime = runtime;
};

/** Clear only this owner's publication; startup/disposal cleanup must not unpublish another owner. */
export const clearServicesRuntime = <R, E>(runtime: ManagedRuntime.ManagedRuntime<R, E>): void => {
  if (Object.is(servicesRuntime, runtime)) servicesRuntime = undefined;
};

/**
 * Predicate for imperative boundaries. False → skip runtime-dependent work; post-activation autobatch
 * handles it once true.
 */
export const isServicesRuntimeReady = (): boolean => isNotUndefined(servicesRuntime);

/**
 * Yields shared runtime or fails `ServicesRuntimeNotReady`. MUST NOT retry: runtime published after graph
 * builds (includes tracing SDK); blocking here deadlocks web activation.
 */
export const getServicesRuntime = Effect.fnUntraced(function* () {
  if (!servicesRuntime) {
    return yield* new ServicesRuntimeNotReady({ message: 'Services runtime is not ready' });
  }
  return servicesRuntime;
});

/** Dispose the runtime (interrupting in-flight fibers). Call before closing the scope that owns the services. */
export const disposeServicesRuntime = Effect.fn('disposeServicesRuntime')(function* () {
  const runtime = servicesRuntime;
  if (runtime) {
    clearServicesRuntime(runtime);
    yield* runtime.disposeEffect;
  }
});
