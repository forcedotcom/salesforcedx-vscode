/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { TelemetryServiceInterface } from '@salesforce/vscode-service-provider';
import type { SalesforceVSCodeCoreApi } from 'salesforcedx-vscode-core';
import * as vscode from 'vscode';

const getCoreExtension = async (): Promise<vscode.Extension<SalesforceVSCodeCoreApi> | undefined> => {
  const coreExtension = vscode.extensions.getExtension<SalesforceVSCodeCoreApi>('salesforce.salesforcedx-vscode-core');
  if (!coreExtension) {
    return undefined;
  }
  if (!coreExtension.isActive) {
    await coreExtension.activate();
  }
  return coreExtension;
};

export const getCoreTelemetryService = async (extensionName: string): Promise<TelemetryServiceInterface | undefined> => {
  const coreExtension = await getCoreExtension();
  if (!coreExtension) {
    return undefined;
  }
  return coreExtension.exports.services.TelemetryService.getInstance(extensionName);
};
