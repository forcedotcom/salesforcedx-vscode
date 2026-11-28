/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
import * as Layer from 'effect/Layer';
import { FileOutputLayer } from './nodeFileOutput.js';

/** Node defaults for Effect Platform filesystem services. */
export const NodeFileOutputPlatformLayer = Layer.merge(NodeFileSystem.layer, NodePath.layer);

/** Provides the Node filesystem and path defaults; callers can override either service. */
export const NodeFileOutputLayer = FileOutputLayer.pipe(Layer.provideMerge(NodeFileOutputPlatformLayer));
