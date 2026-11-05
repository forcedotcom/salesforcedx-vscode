/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Layer from 'effect/Layer';
import { IndexedDBStorageServiceShared } from '../virtualFsProvider/indexedDbStorage.js';
import { ChannelServiceLayer } from './channelService.js';
import { MetadataRegistryServiceLayer } from './metadataRegistryService.js';
import { SettingsServiceLayer } from './settingsService.js';
import { orgLayers } from './targetOrgRef.js';
import { WorkspaceServiceLayer } from './workspaceService.js';

/** Same registry layer identity is provided during web bootstrap and retained by the full graph. */
export const MetadataRegistryWorkspaceLayer = MetadataRegistryServiceLayer.pipe(
  Layer.provideMerge(WorkspaceServiceLayer)
);

/** Stable, network-free services needed by ordered activation bootstrap. */
export const bootstrapServiceLayers = Layer.mergeAll(
  ChannelServiceLayer,
  WorkspaceServiceLayer,
  orgLayers,
  SettingsServiceLayer,
  MetadataRegistryWorkspaceLayer,
  IndexedDBStorageServiceShared
);
