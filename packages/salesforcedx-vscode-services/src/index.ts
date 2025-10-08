/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { sampleProjectName } from './constants';
import { ConfigService } from './core/configService';
import { ConnectionService } from './core/connectionService';
import { defaultOrgRef, watchConfigFiles } from './core/defaultOrgService';
import { MetadataDescribeService } from './core/metadataDescribeService';
import { MetadataRegistryService } from './core/metadataRegistryService';
import { MetadataRetrieveService } from './core/metadataRetrieveService';
import { ProjectService } from './core/projectService';
import { closeExtensionScope, getExtensionScope } from './extensionScope';
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
    TargetOrgRef: typeof defaultOrgRef;
  };
};

/** Effect that runs when the extension is activated */
const activationEffect = (
  context: vscode.ExtensionContext
): Effect.Effect<void, Error, WorkspaceService | SettingsService | IndexedDBStorageService | ChannelService> =>
  Effect.gen(function* () {
    yield* (yield* ChannelService).appendToChannel('Salesforce Services extension is activating!');

    if (Global.isWeb) {
      yield* fileSystemSetup(context);
    }

    // watch the config files for changes, which various serices use to invalidate caches
    yield* Effect.forkIn(watchConfigFiles(), yield* getExtensionScope());
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

  const extensionScope = Effect.runSync(getExtensionScope());
  const channelServiceLayer = ChannelServiceLayer('Salesforce Services');

  const requirements = Layer.mergeAll(
    WorkspaceService.Default,
    SettingsService.Default,
    // TODO: only needed for web, let's find a way to avoid including it in the non-web layer
    IndexedDBStorageServiceShared,
    SdkLayer,
    channelServiceLayer
  );
  await Effect.runPromise(
    Effect.provide(
      activationEffect(context).pipe(
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
      SdkLayer,
      TargetOrgRef: defaultOrgRef
    }
  };
};

/** Deactivates the Salesforce Services extension */
export const deactivate = async (): Promise<void> => {
  await Effect.runPromise(deactivateEffect);
  console.log('Salesforce Services extension is now deactivated!');
};

const deactivateEffect = Effect.gen(function* () {
  yield* closeExtensionScope();
  yield* ChannelService.pipe(
    Effect.flatMap(svc => svc.appendToChannel('Salesforce Services extension is now deactivated!'))
  );
}).pipe(
  Effect.withSpan('deactivation:salesforcedx-vscode-services'),
  Effect.provide(Layer.mergeAll(ChannelServiceLayer('Salesforce Services'), SdkLayer))
);

/** Sets up the virtual file system for the extension */
const fileSystemSetup = (
  context: vscode.ExtensionContext
): Effect.Effect<void, Error, WorkspaceService | ChannelService | SettingsService | IndexedDBStorageService> =>
  Effect.gen(function* () {
    const fsProvider = new FsProvider();

    // Load state from IndexedDB first
    yield* (yield* IndexedDBStorageService).loadState();

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
