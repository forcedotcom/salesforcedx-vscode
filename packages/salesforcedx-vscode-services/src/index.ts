/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Effect } from 'effect';
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
import { projectFiles } from './virtualFsProvider/projectInit';
import { ChannelServiceLayer, ChannelService } from './vscode/channelService';
import { FsService, FsServiceLive } from './vscode/fsService';
import { SettingsService, SettingsServiceLive } from './vscode/settingsService';
import { WorkspaceService, WorkspaceServiceLive } from './vscode/workspaceService';

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
  context: vscode.ExtensionContext,
  channelServiceLayer: ReturnType<typeof ChannelServiceLayer>
): Effect.Effect<void, Error, WorkspaceService | SettingsService> =>
  Effect.gen(function* () {
    // Output activation message using ChannelService
    const svc = yield* ChannelService;
    yield* svc.appendToChannel('Salesforce Services extension is activating!');

    // Set up the file system
    yield* fileSystemSetup(context, channelServiceLayer);
    yield* setupCredentials;
  }).pipe(
    Effect.provide(channelServiceLayer),
    Effect.tapError(error => Effect.sync(() => console.error('❌ [Services] Activation failed:', error)))
  );

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

  await Effect.runPromise(
    Effect.provide(createActivationEffect(context, channelServiceLayer), WorkspaceServiceLive).pipe(
      Effect.provide(SettingsServiceLive),
      Effect.withSpan('activation:salesforcedx-vscode-services'),
      Effect.provide(WebSdkLayer)
    )
  );

  console.log('Salesforce Services extension is now active! 4:17');
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
export const deactivate = (): void => {
  console.log('Salesforce Services extension is now deactivated!');
};

/** Sets up the virtual file system for the extension */
const fileSystemSetup = (
  context: vscode.ExtensionContext,
  channelServiceLayer = ChannelServiceLayer('Salesforce Services')
): Effect.Effect<void, Error, WorkspaceService | ChannelService | SettingsService> =>
  Effect.gen(function* () {
    const channelService = yield* ChannelService;

    //TODO: red the files from workspace, if there is one
    //TODO put the memfs instance into core library
    //TODO: re-instantiate the memfs from browser storage, if there is
    //TODO: init the project if there is not one

    // Check if workspace is virtual file system
    const workspaceDescription = yield* Effect.flatMap(WorkspaceService, ws => ws.getWorkspaceInfo);

    // Initialize file system provider
    const fsProvider = yield* Effect.tryPromise({
      try: () => new FsProvider().init(),
      catch: (error: unknown) => new Error(`Failed to initialize FsProvider: ${String(error)}`)
    });

    // Register the file system provider
    context.subscriptions.push(
      vscode.workspace.registerFileSystemProvider(fsPrefix, fsProvider, {
        isCaseSensitive: true
      })
    );

    if (workspaceDescription.isEmpty) {
      // Initialize workspace with standard files
      yield* channelService.appendToChannel('initializing workspace with standard files');

      yield* projectFiles(fsProvider);
    } else {
      // Copy existing files to virtual file system
      yield* channelService.appendToChannel('Workspace is not empty, copying files to virtual file system');

      // TODO: make this actually work. It's kinda sketchy fighting against the vscode internal fs ext
      // get all the files from the existing workspace and put them in the memfs
      const fileCopyOperations = fsProvider
        .readDirectory(vscode.Uri.parse(workspaceDescription.path))
        .filter(([, fileType]) => fileType === vscode.FileType.File)
        .map(([file]) => {
          const content = fsProvider.readFile(vscode.Uri.parse(`${workspaceDescription.path}/${file}`));
          return fsProvider.writeFile(vscode.Uri.parse(`${fsPrefix}:/${file}`), content, {
            create: true,
            overwrite: true
          });
        });

      yield* Effect.tryPromise({
        try: () => Promise.all(fileCopyOperations),
        catch: (error: unknown) => new Error(`Failed to copy workspace files: ${String(error)}`)
      });
    }

    // Replace the existing workspace with ours
    vscode.workspace.updateWorkspaceFolders(0, 0, {
      name: 'Code Builder',
      uri: vscode.Uri.parse(`${fsPrefix}:/${sampleProjectName}`)
    });

    // Register completion message
    //TODO: read the files from workspace, if there is one
    //TODO: put the memfs instance into core library
    //TODO: re-instantiate the memfs from browser storage, if there is
    //TODO: init the project if there is not one
    yield* channelService.appendToChannel(`Registered ${fsPrefix} file system provider`);
  }).pipe(
    Effect.provide(channelServiceLayer),
    Effect.provide(WorkspaceServiceLive),
    Effect.provide(SettingsServiceLive),
    Effect.provide(WebSdkLayer),
    Effect.withSpan('fileSystemSetup')
  );

// Create Effect for setting up test credentials
// TODO: delete this, or make it a separate extension that we don't ship, etc.  Some way to populate the test environment.
const setupCredentials = Effect.gen(function* () {
  const settingsService = yield* SettingsService;

  const instanceUrl = 'https://app-site-2249-dev-ed.scratch.my.salesforce.com';
  const accessToken =
    '00DD50000003FWG!AQUAQBTnEgzaCsjFIKwHbf.GUSz8N1N4qE2JFe9FveXyS1GeuJapRoD3mJO.XCaQ_t5KNtHh7axPQk_OqbBOtQDD84Cwu260';
  yield* settingsService.setInstanceUrl(instanceUrl);
  yield* settingsService.setAccessToken(accessToken);

  return { instanceUrl, accessToken };
}).pipe(Effect.withSpan('projectInit: setupCredentials'));
