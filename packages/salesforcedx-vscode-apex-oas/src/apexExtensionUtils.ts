/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

export const getApexExtension = async (): Promise<vscode.Extension<any>> => {
  const apexExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-apex');
  if (!apexExtension) {
    throw new Error('Apex extension is not installed');
  }

  if (!apexExtension.isActive) {
    await apexExtension.activate();
  }

  return apexExtension;
};

export const getApexLanguageClient = async (): Promise<any> => {
  const apexExtension = await getApexExtension();
  return apexExtension.exports?.languageClientManager;
};
