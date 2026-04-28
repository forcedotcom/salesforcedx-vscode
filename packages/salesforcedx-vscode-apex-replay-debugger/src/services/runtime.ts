/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as ManagedRuntime from 'effect/ManagedRuntime';
import { AllServicesLayer } from './allServicesLayerRef';

const createReplayDebuggerRuntime = () => ManagedRuntime.make(AllServicesLayer);
let _replayDebuggerRuntime: ReturnType<typeof createReplayDebuggerRuntime> | undefined;
export const getRuntime = () => {
  _replayDebuggerRuntime ??= createReplayDebuggerRuntime();
  return _replayDebuggerRuntime;
};
