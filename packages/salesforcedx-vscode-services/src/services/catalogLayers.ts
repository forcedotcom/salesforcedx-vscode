/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Layer from 'effect/Layer';
import { ApexLogServiceLayer } from './apexLogService.js';
import { ChannelServiceLayer } from './channelService.js';
import { connectionWatcherLayers } from './connectionLayers.js';
import { EditorServiceLayer } from './editorService.js';
import { ExecuteAnonymousServiceLayer } from './executeAnonymousService.js';
import { ExtensionsServiceLayer } from './extensionsService.js';
import { LightningComponentServiceLayer } from './lightningComponentService.js';
import { MediaServiceLayer } from './mediaService.js';
import {
  ActiveMetadataOperationRefLayer,
  MetadataChangeNotificationServiceLayer,
  OrgMetadataCatalogChangePubSubLayer
} from './metadataChangeNotificationService.js';
import { MetadataDeleteServiceLayer } from './metadataDeleteService.js';
import { MetadataDeployServiceLayer } from './metadataDeployService.js';
import { MetadataDescribeServiceLayer } from './metadataDescribeService.js';
import { MetadataOperationNotificationsLayer } from './metadataOperationNotifications.js';
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
import { PromptServiceLayer } from './promptService.js';
import { QueryServiceLayer } from './queryService.js';
import { SourceTrackingServiceLayer } from './sourceTrackingService.js';
import { TemplateServiceLayer } from './templateService.js';
import { terminalPlatformLayer } from './terminalService.js';
import { TraceFlagServiceLayer } from './traceFlagService.js';
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
const tracking = SourceTrackingServiceLayer.pipe(Layer.provideMerge(descriptions));
const operationNotifications = MetadataOperationNotificationsLayer.pipe(Layer.provideMerge(tracking));
const nativeReaders = Layer.mergeAll(QueryServiceLayer, MetadataRetrieveServiceLayer).pipe(
  Layer.provideMerge(operationNotifications)
);
export const catalogReaderLayers = OrgCatalogRemoteRetrieveLayer.pipe(Layer.provideMerge(nativeReaders));
const workspaceInventory = OrgCatalogWorkspaceLayer.pipe(Layer.provideMerge(catalogReaderLayers));
const inventory = OrgCatalogInventoryLayer.pipe(Layer.provideMerge(workspaceInventory));
const catalogInventoryLayers = OrgCatalogTreeProjectionLayer.pipe(Layer.provideMerge(inventory));
const remoteDocuments = OrgCatalogRemoteSourceLayer.pipe(Layer.provideMerge(catalogInventoryLayers));
const catalogDocumentLayers = OrgCatalogDocumentsLayer.pipe(Layer.provideMerge(remoteDocuments));
export const catalogLayers = OrgMetadataCatalogLayer.pipe(Layer.provideMerge(catalogDocumentLayers));
const metadataOperations = Layer.mergeAll(
  MetadataDeployServiceLayer,
  MetadataDeleteServiceLayer,
  LightningComponentServiceLayer
).pipe(Layer.provideMerge(catalogLayers));
export const catalogProviderLayers = Layer.mergeAll(
  OrgMetadataDocumentProviderLayer,
  ApexLogServiceLayer,
  EditorServiceLayer,
  ExecuteAnonymousServiceLayer,
  ExtensionsServiceLayer,
  MediaServiceLayer,
  PromptServiceLayer,
  TemplateServiceLayer,
  TraceFlagServiceLayer,
  terminalPlatformLayer
).pipe(Layer.provideMerge(metadataOperations));
