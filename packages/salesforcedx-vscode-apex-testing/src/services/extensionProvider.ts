/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { buildAllServicesLayer } from '@salesforce/effect-ext-utils';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { CodeCoverageService } from '../codecoverage/codeCoverageService';
import { ApexTestDiscoveryService } from '../discoveryVfs/apexTestDiscoveryService';
import { ApexTestRunCacheService } from '../testRunCache/apexTestRunCacheService';
import { ApexTestTreeService } from '../views/apexTestTreeService';

/** Layer of apex-testing-specific services merged on top of the shared all-services layer. */
const ApexTestingServicesLayer = Layer.mergeAll(
  ApexTestDiscoveryService.Default,
  ApexTestRunCacheService.Default,
  CodeCoverageService.Default,
  ApexTestTreeService.Default
);

/**
 * Layer that provides all services from the SalesforceVSCodeServicesApi plus apex-testing-specific
 * services. Built via the shared buildAllServicesLayer(context, fallbackDisplayName) at activation,
 * then merged with the apex-testing services.
 */
type AllServicesLayerType = Layer.Layer<
  | Layer.Layer.Success<ReturnType<typeof buildAllServicesLayer>>
  | ApexTestDiscoveryService
  | ApexTestRunCacheService
  | CodeCoverageService
  | ApexTestTreeService,
  Layer.Layer.Error<ReturnType<typeof buildAllServicesLayer>>
>;

let AllServicesLayer: AllServicesLayerType;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = Layer.merge(layer, ApexTestingServicesLayer);
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
