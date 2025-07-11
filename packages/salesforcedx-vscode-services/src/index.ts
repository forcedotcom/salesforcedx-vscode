/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { ConnectionService, ConnectionServiceLive } from './core/connectionService';
import { ProjectService, ProjectServiceLive } from './core/projectService';

export type SalesforceVSCodeServicesApi = {
  services: {
    ConnectionService: typeof ConnectionService;
    ConnectionServiceLive: typeof ConnectionServiceLive;
    ProjectService: typeof ProjectService;
    ProjectServiceLive: typeof ProjectServiceLive;
  };
};

/** Activates the Salesforce Services extension and returns API for other extensions to consume */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const activate = async (context: vscode.ExtensionContext): Promise<SalesforceVSCodeServicesApi> => {
  console.log('Salesforce Services extension is now active!');

  // Return API for other extensions to consume
  const api: SalesforceVSCodeServicesApi = {
    services: {
      ConnectionService,
      ConnectionServiceLive,
      ProjectService,
      ProjectServiceLive
    }
  };

  return api;
};

/** Deactivates the Salesforce Services extension */
export const deactivate = (): void => {
  console.log('Salesforce Services extension is now deactivated!');
};
