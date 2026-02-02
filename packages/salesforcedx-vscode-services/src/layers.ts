/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Layer from 'effect/Layer';
import { ComponentSetService } from './core/componentSetService';
import { ConfigService } from './core/configService';
import { ConnectionService } from './core/connectionService';
import { MetadataDeleteService } from './core/metadataDeleteService';
import { MetadataDeployService } from './core/metadataDeployService';
import { MetadataRegistryService } from './core/metadataRegistryService';
import { MetadataRetrieveService } from './core/metadataRetrieveService';
import { ProjectService } from './core/projectService';
import { SourceTrackingService } from './core/sourceTrackingService';
import { ServicesSdkLayer } from './observability/spans';
import { IndexedDBStorageServiceShared } from './virtualFsProvider/indexedDbStorage';
import { FileWatcherService } from './vscode/fileWatcherService';
import { SettingsService } from './vscode/settingsService';
import { SettingsWatcherService } from './vscode/settingsWatcherService';
import { WorkspaceService } from './vscode/workspaceService';

/** they're global in the sense that they should be the same for all extension */
export const globalLayers = Layer.mergeAll(
  ComponentSetService.Default,
  ConfigService.Default,
  ConnectionService.Default,
  FileWatcherService.Default,
  IndexedDBStorageServiceShared,
  MetadataDeleteService.Default,
  MetadataDeployService.Default,
  MetadataRegistryService.Default,
  MetadataRetrieveService.Default,
  ProjectService.Default,
  ServicesSdkLayer(),
  SettingsService.Default,
  SettingsWatcherService.Default,
  SourceTrackingService.Default,
  WorkspaceService.Default
);
