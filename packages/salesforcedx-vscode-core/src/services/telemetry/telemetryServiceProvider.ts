/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
import { TelemetryServiceInterface } from '@salesforce/vscode-service-provider';
import * as vscode from 'vscode';

export const getTelemetryServiceForKey = (key: string | undefined): Promise<TelemetryServiceInterface> => {
  console.log(`key: ${key}`);
  return Promise.resolve(TelemetryService.getInstance(key));
};

export const registerGetTelemetryServiceCommand = () => {
  return vscode.commands.registerCommand(
    'sf.vscode.core.get.telemetry',
    async (key: string | undefined): Promise<TelemetryService> => {
      return (await getTelemetryServiceForKey(key)) as TelemetryService;
    }
  );
};
