/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Effect, Layer, Scope, Exit } from 'effect';
import * as vscode from 'vscode';
import { sampleProjectName } from './constants';
import { ConfigService, ConfigServiceLive } from './core/configService';
import { ConnectionService, ConnectionServiceLive } from './core/connectionService';
import { MetadataDescribeService, MetadataDescribeServiceLive } from './core/metadataDescribeService';
import { MetadataRetrieveService, MetadataRetrieveServiceLive } from './core/metadataRetrieveService';
import { ProjectService, ProjectServiceLive } from './core/projectService';
import { WebSdkLayer } from './observability/spans';
import { fsPrefix } from './virtualFsProvider/constants';
import { FsProvider } from './virtualFsProvider/fileSystemProvider';
import { IndexedDBStorageService, IndexedDBStorageServiceShared } from './virtualFsProvider/indexedDbStorage';
import { startWatch } from './virtualFsProvider/memfsWatcher';
// import { projectFiles } from './virtualFsProvider/projectInit';
import { ChannelServiceLayer, ChannelService } from './vscode/channelService';
import { FsService, FsServiceLive } from './vscode/fsService';
import { SettingsService, SettingsServiceLive } from './vscode/settingsService';
import { WorkspaceService, WorkspaceServiceLive } from './vscode/workspaceService';

// Persistent scope for the extension lifecycle
// eslint-disable-next-line functional/no-let
let extensionScope: Scope.CloseableScope | undefined;

export type SalesforceVSCodeServicesApi = {
  services: {
    ConnectionService: typeof ConnectionService;
    ConnectionServiceLive: typeof ConnectionServiceLive;
    ProjectService: typeof ProjectService;
    ProjectServiceLive: typeof ProjectServiceLive;
    ChannelService: typeof ChannelService;
    ChannelServiceLayer: typeof ChannelServiceLayer;
    WorkspaceService: typeof WorkspaceService;
    WorkspaceServiceLive: typeof WorkspaceServiceLive;
    FsService: typeof FsService;
    FsServiceLive: typeof FsServiceLive;
    ConfigService: typeof ConfigService;
    ConfigServiceLive: typeof ConfigServiceLive;
    MetadataDescribeService: typeof MetadataDescribeService;
    MetadataDescribeServiceLive: typeof MetadataDescribeServiceLive;
    MetadataRetrieveService: typeof MetadataRetrieveService;
    MetadataRetrieveServiceLive: typeof MetadataRetrieveServiceLive;
    SettingsService: typeof SettingsService;
    SettingsServiceLive: typeof SettingsServiceLive;
    WebSdkLayer: typeof WebSdkLayer;
  };
};

/** Creates the activation effect for the services extension */
const createActivationEffect = (
  context: vscode.ExtensionContext
): Effect.Effect<void, Error, WorkspaceService | SettingsService | IndexedDBStorageService | ChannelService> =>
  Effect.gen(function* () {
    // Output activation message using ChannelService
    const svc = yield* ChannelService;
    yield* svc.appendToChannel('Salesforce Services extension is activating!');

    // Set up the file system
    yield* fileSystemSetup(context);
  }).pipe(Effect.tapError(error => Effect.sync(() => console.error('❌ [Services] Activation failed:', error))));

/**
 * Activates the Salesforce Services extension and returns API for other extensions to consume
 * Both service tags/types and their default Live implementations are exported.
 * Consumers should get both from the API, not via direct imports.
 */
export const activate = async (
  context: vscode.ExtensionContext,
  channelServiceLayer = ChannelServiceLayer('Salesforce Services')
): Promise<SalesforceVSCodeServicesApi> => {
  // set the theme as early as possible.  TODO: manage this from CBW instead of in an extension
  const config = vscode.workspace.getConfiguration();
  await config.update('workbench.colorTheme', 'Monokai', vscode.ConfigurationTarget.Global);

  // Create persistent scope for the extension
  extensionScope = await Effect.runPromise(Scope.make());

  const requirements = Layer.mergeAll(
    WorkspaceServiceLive,
    SettingsServiceLive,
    IndexedDBStorageServiceShared,
    WebSdkLayer,
    channelServiceLayer
  );
  await Effect.runPromise(
    Effect.provide(
      createActivationEffect(context).pipe(Effect.withSpan('activation:salesforcedx-vscode-services')),
      requirements
    ).pipe(Scope.extend(extensionScope))
  );

  console.log('Salesforce Services extension is now active! 7:50');
  // Return API for other extensions to consume
  return {
    services: {
      ConnectionService,
      ConnectionServiceLive,
      ProjectService,
      ProjectServiceLive,
      ChannelService,
      ChannelServiceLayer,
      WorkspaceService,
      WorkspaceServiceLive,
      FsService,
      FsServiceLive,
      ConfigService,
      ConfigServiceLive,
      MetadataDescribeService,
      MetadataDescribeServiceLive,
      MetadataRetrieveService,
      MetadataRetrieveServiceLive,
      SettingsService,
      SettingsServiceLive,
      WebSdkLayer
    }
  };
};

/** Deactivates the Salesforce Services extension */
export const deactivate = async (): Promise<void> => {
  if (extensionScope) {
    await Effect.runPromise(Scope.close(extensionScope, Exit.void));
    extensionScope = undefined;
  }
  console.log('Salesforce Services extension is now deactivated!');
};

/** Sets up the virtual file system for the extension */
const fileSystemSetup = (
  context: vscode.ExtensionContext
): Effect.Effect<void, Error, WorkspaceService | ChannelService | SettingsService | IndexedDBStorageService> =>
  Effect.gen(function* () {
    const channelService = yield* ChannelService;

    const fsProvider = new FsProvider();

    // Load state from IndexedDB first
    const storage = yield* IndexedDBStorageService;
    yield* storage.loadState();

    // Register the file system provider
    context.subscriptions.push(
      vscode.workspace.registerFileSystemProvider(fsPrefix, fsProvider, {
        isCaseSensitive: true
      })
    );

    // Replace the existing workspace with ours
    vscode.workspace.updateWorkspaceFolders(0, 0, {
      name: 'Code Builder',
      uri: vscode.Uri.parse(`${fsPrefix}:/${sampleProjectName}`)
    });

    yield* startWatch();

    yield* channelService.appendToChannel('initializing workspace with standard files');

    // yield* projectFiles(fsProvider);

    // Register completion message
    //TODO: read the files from workspace, if there is one
    //TODO: re-instantiate the memfs from browser storage, if there is
    //TODO: init the project if there is not one
    yield* channelService.appendToChannel(`Registered ${fsPrefix} file system provider`);
  }).pipe(Effect.withSpan('fileSystemSetup'));
