/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { Buffer } from 'node:buffer';
import { FileOutputLayer, makeFileOutput } from './nodeFileOutput';

/** Node defaults for Effect Platform filesystem services. */
export const NodeFileOutputPlatformLayer = Layer.merge(NodeFileSystem.layer, NodePath.layer);

/** Provides the Node filesystem and path defaults; callers can override either service. */
export const NodeFileOutputLayer = FileOutputLayer.pipe(Layer.provideMerge(NodeFileOutputPlatformLayer));

/** Standalone Node default for Promise adapters and callers supplying FileOutput directly. */
const nodeServices = NodeFileOutputPlatformLayer.pipe(Layer.build, Effect.scoped, Effect.runSync);
export const NodeFileOutput = makeFileOutput(
  Context.get(nodeServices, FileSystem.FileSystem),
  Context.get(nodeServices, Path.Path),
  text => Buffer.from(text, 'utf8')
);
