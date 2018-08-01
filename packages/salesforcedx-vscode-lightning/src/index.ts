/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as languageServer from '@salesforce/salesforcedx-slds-linter/out/src/client';
import * as vscode from 'vscode';
import { telemetryService } from './telemetry';

export async function activate(context: vscode.ExtensionContext) {
  console.log('SFDX SLDS Linter Extension Activated');
  vscode.workspace.findFiles('**/staticresources/*.resource').then(
    // all good
    (result: vscode.Uri[]) => {
      for (const file of result) {
        if (file.path.search(/(SLDS|slds)[0-9]+/g) !== -1) {
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

  const sfdxCoreExtension = vscode.extensions.getExtension(
    'salesforce.salesforcedx-vscode-core'
  );

  // Telemetry
  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    sfdxCoreExtension.exports.telemetryService.showTelemetryMessage();

    telemetryService.initializeService(
      sfdxCoreExtension.exports.telemetryService.getReporter(),
      sfdxCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  telemetryService.sendExtensionActivationEvent();
}

export function deactivate() {
  console.log('SFDX SLDS Linter Extension Deactivated');
  telemetryService.sendExtensionDeactivationEvent();
}
