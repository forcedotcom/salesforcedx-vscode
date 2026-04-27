/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as ManagedRuntime from 'effect/ManagedRuntime';
import { AllServicesLayer } from './extensionProvider';

const createLwcRuntime = () => ManagedRuntime.make(AllServicesLayer);
let _lwcRuntime: ReturnType<typeof createLwcRuntime> | undefined;
export const getRuntime = () => {
  _lwcRuntime ??= createLwcRuntime();
  return _lwcRuntime;
};
