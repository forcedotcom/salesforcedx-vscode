/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as ManagedRuntime from 'effect/ManagedRuntime';
import { AllServicesLayer } from './extensionProvider';

const createApexRuntime = () => ManagedRuntime.make(AllServicesLayer);
let _apexRuntime: ReturnType<typeof createApexRuntime> | undefined;
export const getRuntime = () => {
  _apexRuntime ??= createApexRuntime();
  return _apexRuntime;
};

// Dispose on deactivate: closing the ManagedRuntime scope runs the NodeSdk finalizer (forceFlush →
// shutdown) so ended spans export instead of relying on the BatchSpanProcessor's UNREF'd 5s timer
// (routinely lost on reload/shutdown). Clears the memo so re-activation rebuilds a fresh runtime.
export const disposeRuntime = async (): Promise<void> => {
  if (_apexRuntime) {
    await _apexRuntime.dispose();
    _apexRuntime = undefined;
  }
};
