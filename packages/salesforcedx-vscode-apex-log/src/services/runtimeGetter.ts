/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as ManagedRuntime from 'effect/ManagedRuntime';

// Forward declaration to avoid circular dependency - use any to avoid needing buildAllServicesLayer type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApexLogRuntime = ManagedRuntime.ManagedRuntime<any, any>;

// eslint-disable-next-line functional/no-let, @typescript-eslint/no-explicit-any -- Module-level mutable; set during activation, read by getRuntime
let allServicesLayer: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setAllServicesLayer = (layer: any): void => {
  allServicesLayer = layer;
};

// eslint-disable-next-line functional/no-let -- Lazy singleton runtime
let _apexLogRuntime: ApexLogRuntime | undefined;

export const getRuntime = (): ApexLogRuntime => (_apexLogRuntime ??= ManagedRuntime.make(allServicesLayer));
