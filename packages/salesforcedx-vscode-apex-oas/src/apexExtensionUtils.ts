/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApexVSCodeApi, LanguageClientManager } from 'salesforcedx-vscode-apex';
import * as vscode from 'vscode';

export const getApexExtension = async (): Promise<vscode.Extension<ApexVSCodeApi>> => {
  const apexExtension = vscode.extensions.getExtension<ApexVSCodeApi>('salesforce.salesforcedx-vscode-apex');
  if (!apexExtension) {
    throw new Error('Apex extension is not installed');
  }

  if (!apexExtension.isActive) {
    await apexExtension.activate();
  }

  return apexExtension;
};

export const getApexLanguageClient = async (): Promise<LanguageClientManager> => {
  const apexExtension = await getApexExtension();
  return apexExtension.exports.languageClientManager;
};
