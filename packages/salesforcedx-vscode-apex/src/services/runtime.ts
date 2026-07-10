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

// Dispose the runtime on deactivate: closing the ManagedRuntime's own scope runs the NodeSdk
// tracer-provider finalizer (forceFlush → shutdown), guaranteeing ended spans (notably the
// long-lived apex.lsp.client span and one-shot event spans) are exported instead of relying on
// the BatchSpanProcessor's default 5s UNREF'd timer, which is routinely lost on reload/shutdown.
// Clears the memo so a re-activation in the same host process rebuilds a fresh runtime.
export const disposeRuntime = async (): Promise<void> => {
  if (_apexRuntime) {
    await _apexRuntime.dispose();
    _apexRuntime = undefined;
  }
};
