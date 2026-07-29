/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Layer from 'effect/Layer';
import { AliasService } from './core/alias';
import { ApexLogService } from './core/apexLogService';
import { ComponentSetService } from './core/componentSetService';
import { ConfigService } from './core/configService';
import { ConnectionService } from './core/connectionService';
import { ExecuteAnonymousService } from './core/executeAnonymousService';
import { LightningComponentService } from './core/lightningComponentService';
import { MetadataChangeNotificationService } from './core/metadataChangeNotificationService';
import { MetadataDeleteService } from './core/metadataDeleteService';
import { MetadataDeployService } from './core/metadataDeployService';
import { MetadataDescribeService } from './core/metadataDescribeService';
import { MetadataRegistryService } from './core/metadataRegistryService';
import { MetadataRetrieveService } from './core/metadataRetrieveService';
import { ProjectService } from './core/projectService';
import { SourceTrackingService } from './core/sourceTrackingService';
import { TemplateService } from './core/templateService';
import { TraceFlagService } from './core/traceFlagService';
import { TransmogrifierService } from './core/transmogrifierService';
import { OrgMetadataCatalog } from './orgVfs/orgMetadataCatalog';
import { OrgMetadataChangePubSub } from './orgVfs/orgMetadataChangePubSub';
import { OrgMetadataResolver } from './orgVfs/orgMetadataResolver';
import { TerminalService } from './terminal/terminalService';
import {
  FileSystemProviderRegistry,
  makeFileSystemProviderRegistry
} from './virtualFsProvider/fileSystemProviderRegistry';
import { EditorService } from './vscode/editorService';
import { ExtensionContextService } from './vscode/extensionContextService';
import { ExtensionsService } from './vscode/extensionsService';
import { FileChangePubSub } from './vscode/fileChangePubSub';
import { FsService } from './vscode/fsService';
import { MediaService } from './vscode/mediaService';
import { PromptService } from './vscode/prompts/promptService';
import { SettingsChangePubSub } from './vscode/settingsChangePubSub';
import { SettingsService } from './vscode/settingsService';
import { WorkspaceService } from './vscode/workspaceService';

/**
 * Global service Defaults (same for all extensions). Leaf module to avoid circular dependency
 * when deriving runtime type from `typeof globalLayers`.
 */
export const makeGlobalLayers = (providerRegistry: Context.Tag.Service<typeof FileSystemProviderRegistry>) => {
  const providerRegistryLayer = Layer.succeed(FileSystemProviderRegistry, providerRegistry);
  const fsServiceLayer = FsService.Default.pipe(Layer.provide(providerRegistryLayer));
  return Layer.mergeAll(
    AliasService.Default,
    TemplateService.Default,
    ExtensionContextService.Default,
    ExecuteAnonymousService.Default,
    ExtensionsService.Default,
    FileChangePubSub.Default,
    ApexLogService.Default,
    ComponentSetService.Default,
    LightningComponentService.Default,
    ConfigService.Default,
    ConnectionService.Default,
    EditorService.Default,
    providerRegistryLayer,
    fsServiceLayer,
    MediaService.Default,
    MetadataChangeNotificationService.Default,
    MetadataDescribeService.Default,
    MetadataDeleteService.Default,
    MetadataDeployService.Default,
    PromptService.Default,
    MetadataRegistryService.Default,
    MetadataRetrieveService.Default,
    OrgMetadataCatalog.Default,
    OrgMetadataChangePubSub.Default,
    OrgMetadataResolver.Default,
    ProjectService.Default,
    SettingsService.Default,
    SettingsChangePubSub.Default,
    SourceTrackingService.Default,
    TerminalService.Default,
    TransmogrifierService.Default,
    TraceFlagService.Default,
    WorkspaceService.Default
  );
};

export const globalLayers = makeGlobalLayers(makeFileSystemProviderRegistry());
