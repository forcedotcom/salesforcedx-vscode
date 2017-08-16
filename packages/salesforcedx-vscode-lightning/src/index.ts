/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as languageServer from '@salesforce/salesforcedx-slds-linter/out/src/client';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('SFDX SLDS Linter Extension Activated');
  const sldsServer = languageServer.createLanguageServer(context).start();
  context.subscriptions.push(sldsServer);
}

export function deactivate() {
  console.log('SFDX SLDS Linter Extension Deactivated');
}
