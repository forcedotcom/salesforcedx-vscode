/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer as buildBaseServicesLayer } from '@salesforce/effect-ext-utils';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

/**
 * Factory for a Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Pass the ExtensionContext to include a working ExtensionContextServiceLayer.
 */
export const buildAllServicesLayer = (context: Parameters<typeof buildBaseServicesLayer>[0]) =>
  buildBaseServicesLayer(context, 'SOQL');

export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};

/**
 * Single persistent runtime for all SOQL extension Effect executions.
 * Built once on first use to avoid rebuilding catalog dependencies and other
 * stateful services across sobject_metadata_request, sobjects_request, and code-completion calls.
 */
type SoqlRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<ReturnType<typeof buildAllServicesLayer>>,
  Layer.Layer.Error<ReturnType<typeof buildAllServicesLayer>>
>;
let _soqlRuntime: SoqlRuntime | undefined;
export const getSoqlRuntime = () => (_soqlRuntime ??= ManagedRuntime.make(AllServicesLayer));
