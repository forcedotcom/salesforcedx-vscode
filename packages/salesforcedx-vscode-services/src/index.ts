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
import { MetadataRetrieveService, MetadataRetrieveServiceLive } from './core/metadataRetrieveService';
import { ProjectService, ProjectServiceLive } from './core/projectService';
import { fsPrefix } from './virtualFsProvider/constants';
import { FsProvider } from './virtualFsProvider/fileSystemProvider';
import { projectFiles } from './virtualFsProvider/projectInit';
import { ChannelServiceLayer, ChannelService } from './vscode/channelService';
import { FsService, FsServiceLive } from './vscode/fsService';
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
    MetadataRetrieveService: typeof MetadataRetrieveService;
    MetadataRetrieveServiceLive: typeof MetadataRetrieveServiceLive;
  };
};

/**
 * Activates the Salesforce Services extension and returns API for other extensions to consume
 * Both service tags/types and their default Live implementations are exported.
 * Consumers should get both from the API, not via direct imports.
 */
export const activate = async (
  context: vscode.ExtensionContext,
  channelServiceLayer = ChannelServiceLayer('Salesforce Services')
): Promise<SalesforceVSCodeServicesApi> => {
  // Output activation message using ChannelService
  await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const svc = yield* ChannelService;
        yield* svc.appendToChannel('Salesforce Services extension is activating!');
      }),
      channelServiceLayer
    )
  );

  await fileSystemSetup(context);

  // Return API for other extensions to consume
  const api: SalesforceVSCodeServicesApi = {
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
      MetadataRetrieveService,
      MetadataRetrieveServiceLive
    }
  };

  console.log('Salesforce Services extension is now active!');
  return api;
};

/** Deactivates the Salesforce Services extension */
export const deactivate = (): void => {
  console.log('Salesforce Services extension is now deactivated!');
};

const fileSystemSetup = async (
  context: vscode.ExtensionContext,
  channelServiceLayer = ChannelServiceLayer('Salesforce Services')
): Promise<void> => {
  // Check if workspace is virtual file system
  await Effect.runPromise(
    Effect.provide(
      Effect.flatMap(WorkspaceService, ws => ws.getWorkspaceDescription),
      WorkspaceServiceLive
    ).pipe(
      Effect.flatMap(workspaceDescription => {
        if (workspaceDescription) {
          return Effect.tryPromise({
            try: async () => {
              const fsProvider = await new FsProvider().init();
              context.subscriptions.push(
                vscode.workspace.registerFileSystemProvider(fsPrefix, fsProvider, {
                  isCaseSensitive: true
                })
              );
              if (workspaceDescription.isEmpty) {
                await Effect.runPromise(
                  Effect.provide(
                    Effect.gen(function* () {
                      const svc = yield* ChannelService;
                      yield* svc.appendToChannel('initializing workspace with standard files');
                    }),
                    channelServiceLayer
                  )
                );
                // if the workspace is empty, init the standard files
                await projectFiles(fsProvider);
              } else {
                await Effect.runPromise(
                  Effect.provide(
                    Effect.gen(function* () {
                      const svc = yield* ChannelService;
                      yield* svc.appendToChannel('Workspace is not empty, copying files to virtual file system');
                    }),
                    channelServiceLayer
                  )
                );
                // TODO: make this actually work.  It's kinda sketchy fighting against he vscode internal fs ext
                // get all the files from the existing workspace and put them in the memfs
                await Promise.all(
                  fsProvider
                    .readDirectory(vscode.Uri.parse(workspaceDescription.path))
                    .filter(([, fileType]) => fileType === vscode.FileType.File)
                    .map(([file]) => {
                      const content = fsProvider.readFile(vscode.Uri.parse(`${workspaceDescription.path}/${file}`));
                      return fsProvider.writeFile(vscode.Uri.parse(`${fsPrefix}:/${file}`), content, {
                        create: true,
                        overwrite: true
                      });
                    })
                );
              }
              // replace the existing workspace with ours.
              vscode.workspace.updateWorkspaceFolders(0, 0, {
                name: 'Code Builder 12:35',
                uri: vscode.Uri.parse(`${fsPrefix}:/${sampleProjectName}`)
              });
            },
            catch: (error: unknown) => new Error(`Failed to initialize fsProvider: ${String(error)}`)
          });
        }
        return Effect.succeed(undefined);
      })
    )
  );

  //TODO: red the files from workspace, if there is one
  //TODO put the memfs instance into core library
  //TODO: re-instantiate the memfs from browser storage, if there is
  //TODO: init the project if there is not one
  await Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const svc = yield* ChannelService;
        yield* svc.appendToChannel(`Registered ${fsPrefix} file system provider`);
      }),
      channelServiceLayer
    )
  );
};
