/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Layer from 'effect/Layer';
import { ConnectionServiceLayer } from './connectionService.js';
import { ConnectionWatcherLayer } from './connectionWatchers.js';
import { foundationalWatcherLayers } from './foundationalLayers.js';

/** No runtime or second foundation graph; stable layers retain memoization across dependent slices. */
export const connectionLayers = ConnectionServiceLayer.pipe(Layer.provideMerge(foundationalWatcherLayers));
export const connectionWatcherLayers = ConnectionWatcherLayer.pipe(Layer.provideMerge(connectionLayers));
