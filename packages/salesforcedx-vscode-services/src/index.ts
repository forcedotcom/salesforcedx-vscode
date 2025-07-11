/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { ConnectionService, ConnectionServiceLive, ProjectService, ProjectServiceLive } from './core';
import { telemetryService } from './telemetry';

export type SalesforceVSCodeServicesApi = {
  telemetryService: typeof telemetryService;
  services: {
    ConnectionService: typeof ConnectionService;
    ConnectionServiceLive: typeof ConnectionServiceLive;
    ProjectService: typeof ProjectService;
    ProjectServiceLive: typeof ProjectServiceLive;
  };
};

/** Activates the Salesforce Services extension and returns API for other extensions to consume */
export const activate = async (context: vscode.ExtensionContext): Promise<SalesforceVSCodeServicesApi> => {
  // Initialize telemetry
  await telemetryService.initializeService(context);

  console.log('Salesforce Services extension is now active!');

  // Return API for other extensions to consume
  const api: SalesforceVSCodeServicesApi = {
    telemetryService,
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

// Re-export for convenience
export { ConnectionService, ConnectionServiceLive, ProjectService, ProjectServiceLive };
export { telemetryService };
