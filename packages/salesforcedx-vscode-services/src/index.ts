/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Effect } from 'effect';
import * as vscode from 'vscode';
import { ConnectionService, ConnectionServiceLive } from './core/connectionService';
import { ProjectService, ProjectServiceLive } from './core/projectService';
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
  };
};

/** Activates the Salesforce Services extension and returns API for other extensions to consume */

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
      FsServiceLive
    }
  };

  console.log('Salesforce Services extension is now active!');
  return api;
};

/** Deactivates the Salesforce Services extension */
export const deactivate = (): void => {
  console.log('Salesforce Services extension is now deactivated!');
};
