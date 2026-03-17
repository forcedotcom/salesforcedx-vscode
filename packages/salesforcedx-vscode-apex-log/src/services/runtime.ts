/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as ManagedRuntime from 'effect/ManagedRuntime';
import { AllServicesLayer } from './allServicesLayerRef';

const createApexLogRuntime = () => ManagedRuntime.make(AllServicesLayer);
// eslint-disable-next-line functional/no-let -- Lazy singleton runtime
let _apexLogRuntime: ReturnType<typeof createApexLogRuntime> | undefined;
export const getRuntime = () => {
  _apexLogRuntime ??= createApexLogRuntime();
  return _apexLogRuntime;
};
