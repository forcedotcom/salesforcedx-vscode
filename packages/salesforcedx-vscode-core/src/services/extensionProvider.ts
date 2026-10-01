/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { buildAllServicesLayer } from '@salesforce/effect-ext-utils';
import * as Layer from 'effect/Layer';
import { WorkspaceContextService } from '../context/workspaceContextService';

/**
 * Layer that provides all services from the SalesforceVSCodeServicesApi.
 * Set via setAllServicesLayer during extension activation; consumed by getRuntime().
 */
export let AllServicesLayer: ReturnType<typeof buildCoreServicesLayer>;

export const buildCoreServicesLayer = (layer: ReturnType<typeof buildAllServicesLayer>) =>
  Layer.merge(layer, Layer.provide(WorkspaceContextService.Default, layer));

export const setAllServicesLayer = (layer: ReturnType<typeof buildCoreServicesLayer>) => {
  AllServicesLayer = layer;
};
