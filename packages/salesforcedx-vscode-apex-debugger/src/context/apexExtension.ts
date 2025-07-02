/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ApexVSCodeApi } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';

/** Get the active Apex extension */
export const getActiveApexExtension = async (): Promise<vscode.Extension<ApexVSCodeApi>> => {
  const salesforceApexExtension = vscode.extensions.getExtension<ApexVSCodeApi>('salesforce.salesforcedx-vscode-apex');
  if (!salesforceApexExtension) {
    throw new Error('Apex extension not found');
  }
  if (!salesforceApexExtension.isActive) {
    await salesforceApexExtension.activate();
  }
  return salesforceApexExtension;
};
