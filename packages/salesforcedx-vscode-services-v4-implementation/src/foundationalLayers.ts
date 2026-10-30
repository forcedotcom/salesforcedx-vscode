/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Layer from 'effect/Layer';
import { AliasServiceLayer } from './aliasService.js';
import { FileChangePubSubLayer, SettingsChangePubSubLayer } from './changePubSubs.js';
import { ConfigServiceLayer } from './configService.js';
import { FileWatcherLayer } from './fileWatcher.js';
import { FsServiceLayer } from './fsService.js';
import { HostFileWatcherLayer } from './hostFileWatcher.js';
import { SettingsServiceLayer } from './settingsService.js';
import { SettingsWatcherLayer } from './settingsWatcher.js';
import { orgLayers } from './targetOrgRef.js';
import { WorkspaceServiceLayer } from './workspaceService.js';

const workspaceAndOrg = Layer.mergeAll(WorkspaceServiceLayer, orgLayers);
const config = ConfigServiceLayer.pipe(Layer.provide(workspaceAndOrg));
const alias = AliasServiceLayer.pipe(Layer.provide(FsServiceLayer));
const events = Layer.mergeAll(FileChangePubSubLayer, SettingsChangePubSubLayer);

/** Stable layer graph, not a runtime: later slices reuse these exact values and their memoized dependencies. */
export const foundationalLayers = Layer.mergeAll(
  workspaceAndOrg,
  config,
  alias,
  FsServiceLayer,
  SettingsServiceLayer,
  HostFileWatcherLayer,
  events
);

/** Requires the host's WebFileSystemProvider getter and the eventual V4 ChannelService implementation. */
export const foundationalWatcherLayers = Layer.mergeAll(FileWatcherLayer, SettingsWatcherLayer).pipe(
  Layer.provideMerge(foundationalLayers)
);
