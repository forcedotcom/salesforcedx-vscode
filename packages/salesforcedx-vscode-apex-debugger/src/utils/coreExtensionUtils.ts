/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SalesforceVSCodeCoreApi } from 'salesforcedx-vscode-core';
import * as vscode from 'vscode';

const getSalesforceCoreExtension = (): vscode.Extension<SalesforceVSCodeCoreApi> => {
  const extension = vscode.extensions.getExtension<SalesforceVSCodeCoreApi>('salesforce.salesforcedx-vscode-core');
  if (!extension) {
    throw new Error('Salesforce Core Extension not available');
  }
  return extension;
};

/** Get the active Salesforce Core extension */
const getActiveSalesforceCoreExtension = async (): Promise<vscode.Extension<SalesforceVSCodeCoreApi>> => {
  const salesforceCoreExtension = getSalesforceCoreExtension();
  if (!salesforceCoreExtension.isActive) {
    await salesforceCoreExtension.activate();
  }
  return salesforceCoreExtension;
};

/** Get the telemetry service from the Salesforce Core extension */
export const getTelemetryService = async () => (await getActiveSalesforceCoreExtension()).exports.telemetryService;
