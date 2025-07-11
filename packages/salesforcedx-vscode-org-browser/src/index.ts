/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  console.log('Salesforce Org Browser extension is now active!');
};

export const deactivate = (): void => {
  console.log('Salesforce Org Browser extension is now deactivated!');
};
