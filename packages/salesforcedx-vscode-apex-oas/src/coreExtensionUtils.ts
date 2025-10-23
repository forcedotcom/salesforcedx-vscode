/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

export const getVscodeCoreExtension = async (): Promise<vscode.Extension<any>> => {
  const coreExtension = vscode.extensions.getExtension('salesforce.salesforcedx-vscode-core');
  if (!coreExtension) {
    throw new Error('Core extension is not installed');
  }

  if (!coreExtension.isActive) {
    await coreExtension.activate();
  }

  return coreExtension;
};
