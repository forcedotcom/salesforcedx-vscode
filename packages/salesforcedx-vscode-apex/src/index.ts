/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/lib/main';
import {
  getApexTests,
  getExceptionBreakpointInfo,
  getLineBreakpointInfo,
  isLanguageClientReady,
  LanguageClientUtils
} from './languageClientUtils';
import * as languageServer from './languageServer';
import { telemetryService } from './telemetry';
import { ApexTestOutlineProvider } from './views/testOutlineProvider';
import { ApexTestRunner } from './views/testRunner';

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);

let languageClient: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();
  const testOutlineProvider = new ApexTestOutlineProvider(null);
  // Telemetry
  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    sfdxCoreExtension.exports.telemetryService.showTelemetryMessage();

    telemetryService.initializeService(
      sfdxCoreExtension.exports.telemetryService.getReporter(),
      sfdxCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  const langClientHRStart = process.hrtime();
  languageClient = await languageServer.createLanguageServer(context);
  LanguageClientUtils.setClientInstance(languageClient);
  const handle = languageClient.start();
  context.subscriptions.push(handle);

  languageClient
    .onReady()
    .then(async () => {
      LanguageClientUtils.languageClientReady = true;
      await testOutlineProvider.refresh();
      telemetryService.sendApexLSPActivationEvent(langClientHRStart);
    })
    .catch(err => {
      // Handled by clients
      telemetryService.sendApexLSPError(err);
    });

  context.subscriptions.push(await registerTestView(testOutlineProvider));

  const exportedApi = {
    getLineBreakpointInfo,
    getExceptionBreakpointInfo,
    isLanguageClientReady,
    getApexTests
  };

  telemetryService.sendExtensionActivationEvent(extensionHRStart);
  return exportedApi;
}

async function registerTestView(
  testOutlineProvider: ApexTestOutlineProvider
): Promise<vscode.Disposable> {
  // Create TestRunner
  const testRunner = new ApexTestRunner(testOutlineProvider);

  // Test View
  const testViewItems = new Array<vscode.Disposable>();

  const testProvider = vscode.window.registerTreeDataProvider(
    'sfdx.force.test.view',
    testOutlineProvider
  );
  testViewItems.push(testProvider);

  // Run Test Button on Test View command
  testViewItems.push(
    vscode.commands.registerCommand('sfdx.force.test.view.run', () =>
      testRunner.runApexTests()
    )
  );
  // Show Error Message command
  testViewItems.push(
    vscode.commands.registerCommand('sfdx.force.test.view.showError', test =>
      testRunner.showErrorMessage(test)
    )
  );
  // Run Single Test command
  testViewItems.push(
    vscode.commands.registerCommand(
      'sfdx.force.test.view.runSingleTest',
      test => testRunner.runSingleTest(test)
    )
  );
  // Refresh Test View command
  testViewItems.push(
    vscode.commands.registerCommand('sfdx.force.test.view.refresh', () =>
      testOutlineProvider.refresh()
    )
  );

  return vscode.Disposable.from(...testViewItems);
}

export async function getApexClassFiles(): Promise<vscode.Uri[]> {
  const jsonProject = (await vscode.workspace.findFiles(
    '**/sfdx-project.json'
  ))[0];
  const innerText = fs.readFileSync(jsonProject.path);
  const jsonObject = JSON.parse(innerText.toString());
  const packageDirectories =
    jsonObject.packageDirectories || jsonObject.PackageDirectories;
  const allClasses = new Array<vscode.Uri>();
  for (const packageDirectory of packageDirectories) {
    const pattern = path.join(packageDirectory.path, '**/*.cls');
    const apexClassFiles = await vscode.workspace.findFiles(pattern);
    allClasses.push(...apexClassFiles);
  }
  return allClasses;
}

// tslint:disable-next-line:no-empty
export function deactivate() {
  telemetryService.sendExtensionDeactivationEvent();
}
