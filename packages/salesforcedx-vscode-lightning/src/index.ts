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
  vscode.workspace.findFiles('**/staticresources/*.resource').then(
    // all good
    (result: vscode.Uri[]) => {
      for (let i = 0; i < result.length; i++) {
        if (result[i].path.search(/(SLDS|slds)[0-9]+/g) !== -1) {
          return;
        }
      }
      const sldsServer = languageServer.createLanguageServer(context).start();
      context.subscriptions.push(sldsServer);
    },
    // rejected
    (reason: any) => {
      // output error
      vscode.window.showErrorMessage(reason);
    }
  );
}

export function deactivate() {
  console.log('SFDX SLDS Linter Extension Deactivated');
}