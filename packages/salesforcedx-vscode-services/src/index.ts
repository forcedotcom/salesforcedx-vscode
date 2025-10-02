/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core/global';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { sampleProjectName } from './constants';
import { ConfigService } from './core/configService';
import { ConnectionService } from './core/connectionService';
import { MetadataDescribeService } from './core/metadataDescribeService';
import { MetadataRegistryService } from './core/metadataRegistryService';
import { MetadataRetrieveService } from './core/metadataRetrieveService';
import { ProjectService } from './core/projectService';
import { SdkLayer } from './observability/spans';
import { fsPrefix } from './virtualFsProvider/constants';
import { FsProvider } from './virtualFsProvider/fileSystemProvider';
import { IndexedDBStorageService, IndexedDBStorageServiceShared } from './virtualFsProvider/indexedDbStorage';
import { startWatch } from './virtualFsProvider/memfsWatcher';
import { projectFiles } from './virtualFsProvider/projectInit';
import { ChannelServiceLayer, ChannelService } from './vscode/channelService';
import { FsService } from './vscode/fsService';
import { SettingsService } from './vscode/settingsService';
import { WorkspaceService } from './vscode/workspaceService';

// Persistent scope for the extension lifecycle
// eslint-disable-next-line functional/no-let
let extensionScope: Scope.CloseableScope | undefined;

export type SalesforceVSCodeServicesApi = {
  services: {
    ConnectionService: typeof ConnectionService;
    ProjectService: typeof ProjectService;
    ChannelService: typeof ChannelService;
    ChannelServiceLayer: typeof ChannelServiceLayer;
    WorkspaceService: typeof WorkspaceService;
    FsService: typeof FsService;
    ConfigService: typeof ConfigService;
    MetadataDescribeService: typeof MetadataDescribeService;
    MetadataRegistryService: typeof MetadataRegistryService;
    MetadataRetrieveService: typeof MetadataRetrieveService;
    SettingsService: typeof SettingsService;
    SdkLayer: typeof SdkLayer;
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

    if (Global.isWeb) {
      // Set up the file system for web extensions
      yield* fileSystemSetup(context);
    }
  }).pipe(Effect.tapError(error => Effect.sync(() => console.error('❌ [Services] Activation failed:', error))));

/**
 * Activates the Salesforce Services extension and returns API for other extensions to consume
 * Both service tags/types and their default Live implementations are exported.
 * Consumers should get both from the API, not via direct imports.
 */
export const activate = async (context: vscode.ExtensionContext): Promise<SalesforceVSCodeServicesApi> => {
  if (Global.isWeb) {
    // set the theme as early as possible.  TODO: manage this from CBW instead of in an extension
    const config = vscode.workspace.getConfiguration();
    await config.update('workbench.colorTheme', 'Monokai', vscode.ConfigurationTarget.Global);
    if (process.env.ESBUILD_PLATFORM === 'web') {
      const { getWebAppInsightsReporter } = await import('./observability/applicationInsightsWebExporter.js');
      context.subscriptions.push(getWebAppInsightsReporter());
    }
  }
  // Create persistent scope for the extension
  extensionScope = await Effect.runPromise(Scope.make());

  const channelServiceLayer = ChannelServiceLayer('Salesforce Services');

  const requirements = Layer.mergeAll(
    WorkspaceService.Default,
    SettingsService.Default,
    IndexedDBStorageServiceShared,
    SdkLayer,
    channelServiceLayer
  );
  await Effect.runPromise(
    Effect.provide(
      createActivationEffect(context).pipe(
        Effect.withSpan('activation:salesforcedx-vscode-services', { attributes: { isWeb: Global.isWeb } })
      ),
      requirements
    ).pipe(Scope.extend(extensionScope))
  );

  console.log('Salesforce Services extension is now active! 7:50');
  // Return API for other extensions to consume
  return {
    services: {
      ConnectionService,
      ProjectService,
      ChannelService,
      ChannelServiceLayer,
      WorkspaceService,
      FsService,
      ConfigService,
      MetadataDescribeService,
      MetadataRegistryService,
      MetadataRetrieveService,
      SettingsService,
      SdkLayer
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
    yield* projectFiles(fsProvider);
  }).pipe(Effect.withSpan('fileSystemSetup'));
