/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import type { SalesforceVSCodeCoreApi } from 'salesforcedx-vscode-core';
import * as vscode from 'vscode';
import { nls } from '../messages';

export const getActiveSalesforceCoreExtension = async (): Promise<SalesforceVSCodeCoreApi> => {
  const salesforceCoreExtension = vscode.extensions.getExtension<SalesforceVSCodeCoreApi>(
    'salesforce.salesforcedx-vscode-core'
  );
  if (!salesforceCoreExtension) {
    throw new Error(nls.localize('unable_to_load_vscode_core_extension'));
  }
  if (!salesforceCoreExtension?.isActive) {
    await salesforceCoreExtension?.activate();
  }
  return salesforceCoreExtension.exports;
};

export const getActiveSalesforceApexExtension = async (): Promise<ApexVSCodeApi> => {
  const salesforceApexExtension = vscode.extensions.getExtension<ApexVSCodeApi>('salesforce.salesforcedx-vscode-apex');
  if (!salesforceApexExtension) {
    throw new Error(nls.localize('unable_to_load_vscode_apex_extension'));
  }
  if (!salesforceApexExtension?.isActive) {
    await salesforceApexExtension?.activate();
  }
  return salesforceApexExtension.exports;
};
