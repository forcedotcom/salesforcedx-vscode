/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ActiveMetadataOperationRef } from './activeMetadataOperationRef.js';
import { AliasService } from './aliasService.js';
import { ChannelService } from './channelService.js';
import { ComponentSetService } from './componentSetService.js';
import { ConfigService } from './configService.js';
import { ConnectionService } from './connectionService.js';
import { FileChangePubSub } from './fileChangePubSub.js';
import { FsService } from './fsService.js';
import { HostFileWatcher } from './hostFileWatcher.js';
import { MetadataChangeNotificationService } from './metadataChangeNotificationService.js';
import { MetadataDescribeService } from './metadataDescribeService.js';
import { MetadataRegistryService } from './metadataRegistryService.js';
import { MetadataRetrieveService } from './metadataRetrieveService.js';
import { OrgMetadataCatalog } from './orgMetadataCatalog.js';
import { OrgMetadataCatalogChangePubSub } from './orgMetadataCatalogChangePubSub.js';
import { ProjectService } from './projectService.js';
import { QueryService } from './queryService.js';
import { SettingsChangePubSub } from './settingsChangePubSub.js';
import { SettingsService } from './settingsService.js';
import { SourceTrackingService } from './sourceTrackingService.js';
import { TargetOrgRef } from './targetOrgRef.js';
import { TransmogrifierService } from './transmogrifierService.js';
import { WorkspaceService } from './workspaceService.js';

/** Explicit customer-facing keys, shared by the API type and the owning graph's Context projection. */
export const publicServiceKeys = {
  ActiveMetadataOperationRef,
  AliasService,
  ChannelService,
  ComponentSetService,
  ConfigService,
  ConnectionService,
  FileChangePubSub,
  FsService,
  HostFileWatcher,
  MetadataChangeNotificationService,
  MetadataDescribeService,
  MetadataRegistryService,
  MetadataRetrieveService,
  OrgMetadataCatalog,
  OrgMetadataCatalogChangePubSub,
  ProjectService,
  QueryService,
  SettingsChangePubSub,
  SettingsService,
  SourceTrackingService,
  TargetOrgRef,
  TransmogrifierService,
  WorkspaceService
} as const;
export type PublicServices = (typeof publicServiceKeys)[keyof typeof publicServiceKeys]['Identifier'];
