/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Layer from 'effect/Layer';
import { ChannelServiceLayer } from './channelService.js';
import { connectionWatcherLayers } from './connectionLayers.js';
import {
  ActiveMetadataOperationRefLayer,
  MetadataChangeNotificationServiceLayer,
  OrgMetadataCatalogChangePubSubLayer
} from './metadataChangeNotificationService.js';
import { MetadataDescribeServiceLayer } from './metadataDescribeService.js';
import { MetadataRetrieveServiceLayer } from './metadataRetrieveService.js';
import { OrgCatalogDocumentsLayer } from './orgCatalog/orgCatalogDocuments.js';
import { OrgCatalogInventoryLayer } from './orgCatalog/orgCatalogInventory.js';
import { OrgCatalogRemoteRetrieveLayer } from './orgCatalog/orgCatalogRemoteRetrieve.js';
import { OrgCatalogRemoteSourceLayer } from './orgCatalog/orgCatalogRemoteSource.js';
import { OrgCatalogStateLayer } from './orgCatalog/orgCatalogState.js';
import { OrgCatalogTreeProjectionLayer } from './orgCatalog/orgCatalogTreeProjection.js';
import { OrgCatalogWorkspaceLayer } from './orgCatalog/orgCatalogWorkspace.js';
import { OrgMetadataCatalogLayer } from './orgCatalog/orgMetadataCatalog.js';
import { OrgMetadataCatalogRecorderLayer } from './orgCatalog/orgMetadataCatalogRecorder.js';
import { OrgMetadataCatalogStoreLayer } from './orgCatalog/orgMetadataCatalogStore.js';
import { OrgMetadataDocumentProviderLayer } from './orgCatalog/orgMetadataDocumentProvider.js';
import { OrgMetadataShadowStoreLayer } from './orgCatalog/orgMetadataShadowStore.js';
import { OrgSemanticArtifactPersistenceLayer } from './orgCatalog/orgSemanticArtifactPersistence.js';
import { OrgSemanticArtifactStoreLayer } from './orgCatalog/orgSemanticArtifactStore.js';
import { projectLayers } from './projectLayers.js';
import { QueryServiceLayer } from './queryService.js';
import { SourceTrackingServiceLayer } from './sourceTrackingService.js';
import { TransmogrifierServiceLayer } from './transmogrifierService.js';

const connections = connectionWatcherLayers.pipe(Layer.provideMerge(ChannelServiceLayer));
const projects = projectLayers.pipe(Layer.provideMerge(connections));
const stores = Layer.mergeAll(
  OrgMetadataCatalogStoreLayer,
  OrgMetadataShadowStoreLayer,
  OrgSemanticArtifactStoreLayer,
  TransmogrifierServiceLayer,
  MetadataChangeNotificationServiceLayer,
  ActiveMetadataOperationRefLayer,
  OrgMetadataCatalogChangePubSubLayer
).pipe(Layer.provideMerge(projects));
const state = OrgCatalogStateLayer.pipe(Layer.provideMerge(stores));
const recorder = OrgMetadataCatalogRecorderLayer.pipe(Layer.provideMerge(state));
const descriptions = Layer.mergeAll(MetadataDescribeServiceLayer, OrgSemanticArtifactPersistenceLayer).pipe(
  Layer.provideMerge(recorder)
);
const nativeReaders = Layer.mergeAll(QueryServiceLayer, MetadataRetrieveServiceLayer, SourceTrackingServiceLayer).pipe(
  Layer.provideMerge(descriptions)
);
export const catalogReaderLayers = OrgCatalogRemoteRetrieveLayer.pipe(Layer.provideMerge(nativeReaders));
const workspaceInventory = OrgCatalogWorkspaceLayer.pipe(Layer.provideMerge(catalogReaderLayers));
const inventory = OrgCatalogInventoryLayer.pipe(Layer.provideMerge(workspaceInventory));
export const catalogInventoryLayers = OrgCatalogTreeProjectionLayer.pipe(Layer.provideMerge(inventory));
const remoteDocuments = OrgCatalogRemoteSourceLayer.pipe(Layer.provideMerge(catalogInventoryLayers));
export const catalogDocumentLayers = OrgCatalogDocumentsLayer.pipe(Layer.provideMerge(remoteDocuments));
export const catalogLayers = OrgMetadataCatalogLayer.pipe(Layer.provideMerge(catalogDocumentLayers));
export const catalogProviderLayers = OrgMetadataDocumentProviderLayer.pipe(Layer.provideMerge(catalogLayers));
