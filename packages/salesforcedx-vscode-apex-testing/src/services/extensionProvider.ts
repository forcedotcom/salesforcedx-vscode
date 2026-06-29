/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { buildAllServicesLayer } from '@salesforce/effect-ext-utils';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { ApexTestDiscoveryService } from '../discoveryVfs/apexTestDiscoveryService';
import { ApexTestRunCacheService } from '../testRunCache/apexTestRunCacheService';

/** Layer of apex-testing-specific services merged on top of the shared all-services layer. */
// ApexTestDiscoveryService.Default carries ApexTestingDiscoveryFsProviderLive via its dependencies.
// ApexTestRunCacheService.Default tracks last executed test class/method for rerun commands.
const ApexTestingServicesLayer = Layer.merge(ApexTestDiscoveryService.Default, ApexTestRunCacheService.Default);

/**
 * Layer that provides all services from the SalesforceVSCodeServicesApi plus apex-testing-specific
 * services. Built via the shared buildAllServicesLayer(context, fallbackDisplayName) at activation,
 * then merged with the apex-testing services. Type derived from the `Layer.merge` to keep the union in sync.
 */
const mergeAllServices = (layer: ReturnType<typeof buildAllServicesLayer>) =>
  Layer.merge(layer, ApexTestingServicesLayer);
type AllServicesLayerType = ReturnType<typeof mergeAllServices>;

let AllServicesLayer: AllServicesLayerType;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = mergeAllServices(layer);
};

/**
 * Single persistent runtime for apex-testing Effect executions.
 * Built once on first use to avoid rebuilding ComponentSetService and other
 * stateful services across test discovery, runs, and code-completion calls
 */
type ApexTestingRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<AllServicesLayerType>,
  Layer.Layer.Error<AllServicesLayerType>
>;
let _apexTestingRuntime: ApexTestingRuntime | undefined;
export const getApexTestingRuntime = () => (_apexTestingRuntime ??= ManagedRuntime.make(AllServicesLayer));
