/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as ManagedRuntime from 'effect/ManagedRuntime';
import { AllServicesLayer } from './extensionProvider';

const createCoreRuntime = () => ManagedRuntime.make(AllServicesLayer);
let _coreRuntime: ReturnType<typeof createCoreRuntime> | undefined;
export const getRuntime = () => {
  _coreRuntime ??= createCoreRuntime();
  return _coreRuntime;
};
