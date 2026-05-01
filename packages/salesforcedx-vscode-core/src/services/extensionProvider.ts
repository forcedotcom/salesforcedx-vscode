/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer as buildAllServicesLayerCore } from '@salesforce/effect-ext-utils';
import type { ExtensionContext } from 'vscode';

/**
 * Factory for a Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Pass the ExtensionContext to include a working ExtensionContextServiceLayer.
 */
export const buildAllServicesLayer = (context: ExtensionContext) =>
  buildAllServicesLayerCore(context, 'Salesforce CLI');

/**
 * Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Set via setAllServicesLayer during extension activation; consumed by getRuntime().
 */
export let AllServicesLayer: ReturnType<typeof buildAllServicesLayer>;

export const setAllServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) => {
  AllServicesLayer = layer;
};
