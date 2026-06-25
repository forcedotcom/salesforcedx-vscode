/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { buildAllServicesLayer } from '@salesforce/effect-ext-utils';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

/**
 * Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Built via the shared buildAllServicesLayer(context, fallbackDisplayName) at activation.
 */

let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

/**
 * Single persistent runtime for apex-testing Effect executions.
 * Built once on first use to avoid rebuilding ComponentSetService and other
 * stateful services across test discovery, runs, and code-completion calls
 */
type ApexTestingRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<ReturnType<typeof buildAllServicesLayer>>,
  Layer.Layer.Error<ReturnType<typeof buildAllServicesLayer>>
>;
let _apexTestingRuntime: ApexTestingRuntime | undefined;
export const getApexTestingRuntime = () => (_apexTestingRuntime ??= ManagedRuntime.make(AllServicesLayer));
