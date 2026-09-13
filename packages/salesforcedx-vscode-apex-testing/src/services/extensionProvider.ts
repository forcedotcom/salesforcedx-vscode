/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { buildAllServicesLayer as buildBaseServicesLayer, getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import type { ExtensionContext } from 'vscode';
import { CodeCoverageService } from '../codecoverage/codeCoverageService';
import { PackageResolutionService } from '../testDiscovery/packageResolution';
import { ApexTestRunCacheService } from '../testRunCache/apexTestRunCacheService';
import { ApexTestExecutionService } from '../views/apexTestExecutionService';
import { ApexTestTreeService } from '../views/apexTestTreeService';

/** Layer of apex-testing-specific services merged on top of the shared all-services layer. */
const ApexTestingServicesLayer = Layer.mergeAll(
  ApexTestRunCacheService.Default,
  CodeCoverageService.Default,
  PackageResolutionService.Default,
  ApexTestTreeService.Default,
  ApexTestExecutionService.Default
);

/**
 * Layer that provides all services from the SalesforceVSCodeServicesApi (including NotificationModeService,
 * so run/suite/retrieve commands can emit a single combined success toast instead of ad hoc showInformationMessage
 * calls) plus apex-testing-specific services.
 */
export const buildAllServicesLayer = (context: ExtensionContext, fallbackDisplayName: string) =>
  Layer.unwrapEffect(
    Effect.map(getServicesApi, api =>
      Layer.mergeAll(
        buildBaseServicesLayer(context, fallbackDisplayName),
        ApexTestingServicesLayer,
        api.services.NotificationModeService.Default(
          'salesforcedx-vscode-apex-testing',
          'sf-apex-testing-notifications',
          'Salesforce: Apex Testing Notifications'
        )
      )
    )
  );

// eslint-disable-next-line functional/no-let -- module-level mutable set once via setAllServicesLayer at activation
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
// eslint-disable-next-line functional/no-let -- module-level lazy singleton, assigned once via ??= in getApexTestingRuntime
let _apexTestingRuntime: ApexTestingRuntime | undefined;
export const getApexTestingRuntime = () => (_apexTestingRuntime ??= ManagedRuntime.make(AllServicesLayer));
