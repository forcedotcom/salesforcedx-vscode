/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';

let servicesApi: SalesforceVSCodeServicesApi | undefined;

/**
 * Gets the Salesforce Services extension API, activating if needed.
 * This provides access to all services from the services extension.
 */
export const getServicesApi = async (): Promise<SalesforceVSCodeServicesApi> => {
  if (servicesApi) {
    return servicesApi;
  }

  const extension = vscode.extensions.getExtension<SalesforceVSCodeServicesApi>(
    'salesforce.salesforcedx-vscode-services'
  );

  if (!extension) {
    throw new Error('Salesforce Services extension not found');
  }

  if (!extension.isActive) {
    await extension.activate();
  }

  const api = extension.exports;
  if (!api?.services) {
    throw new Error('Invalid Services API');
  }

  servicesApi = api;
  return servicesApi;
};
