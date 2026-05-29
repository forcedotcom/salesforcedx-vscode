/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// type-only import: TS strips this, no runtime cycle
import type { buildAllServicesLayer } from './extensionProvider';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';

type ServicesLayer = ReturnType<typeof buildAllServicesLayer>;
type ApexLogRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<ServicesLayer>,
  Layer.Layer.Error<ServicesLayer>
>;

// eslint-disable-next-line functional/no-let -- Module-level mutable; set during activation, read by getRuntime
let allServicesLayer: ServicesLayer;

export const setAllServicesLayer = (layer: ServicesLayer): void => {
  allServicesLayer = layer;
};

// eslint-disable-next-line functional/no-let -- Lazy singleton runtime
let _apexLogRuntime: ApexLogRuntime | undefined;

export const getRuntime = (): ApexLogRuntime => (_apexLogRuntime ??= ManagedRuntime.make(allServicesLayer));
