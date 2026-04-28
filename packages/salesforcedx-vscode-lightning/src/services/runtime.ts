/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as ManagedRuntime from 'effect/ManagedRuntime';
import { AllServicesLayer } from './extensionProvider';

const createLightningRuntime = () => ManagedRuntime.make(AllServicesLayer);
let _lightningRuntime: ReturnType<typeof createLightningRuntime> | undefined;
export const getRuntime = () => {
  _lightningRuntime ??= createLightningRuntime();
  return _lightningRuntime;
};
