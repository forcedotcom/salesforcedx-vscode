/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import {
  DEBUGGER_EXCEPTION_BREAKPOINTS,
  DEBUGGER_LINE_BREAKPOINTS
} from './constants';
import * as languageServer from './languageServer';
import { telemetryService } from './telemetry';
import {
  ApexLSPConverter,
  ApexTestMethod,
  LSPApexTestMethod
} from './views/LSPConverter';
import { ApexTestOutlineProvider } from './views/testOutline';

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);

let languageClient: LanguageClient | undefined;
let languageClientReady = false;

export async function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.workspaceFolders![0].name;
  const testOutlineProvider = new ApexTestOutlineProvider(rootPath, null);
  // Telemetry
  if (sfdxCoreExtension && sfdxCoreExtension.exports) {
    sfdxCoreExtension.exports.telemetryService.showTelemetryMessage();

    telemetryService.initializeService(
      sfdxCoreExtension.exports.telemetryService.getReporter(),
      sfdxCoreExtension.exports.telemetryService.isTelemetryEnabled()
    );
  }

  telemetryService.sendExtensionActivationEvent();

  languageClient = await languageServer.createLanguageServer(context);
  if (languageClient) {
    const handle = languageClient.start();
    context.subscriptions.push(handle);

    languageClient.onReady().then(async () => {
      languageClientReady = true;
      await testOutlineProvider.refresh();
    });
  }

  context.subscriptions.push(await registerTestView(testOutlineProvider));

  const exportedApi = {
    getLineBreakpointInfo,
    getExceptionBreakpointInfo,
    isLanguageClientReady,
    getApexTests
  };
  return exportedApi;
}

async function getLineBreakpointInfo(): Promise<{}> {
  let response = {};
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_LINE_BREAKPOINTS);
  }
  return Promise.resolve(response);
}

export async function getApexTests(): Promise<ApexTestMethod[]> {
  let response = new Array<LSPApexTestMethod>();
  const ret = new Array<ApexTestMethod>();
  if (languageClient) {
    response = (await languageClient.sendRequest(
      'test/getTestMethods'
    )) as LSPApexTestMethod[];
  }
  for (const requestInfo of response) {
    ret.push(ApexLSPConverter.toApexTestMethod(requestInfo));
  }
  return Promise.resolve(ret);
}

async function getExceptionBreakpointInfo(): Promise<{}> {
  let response = {};
  if (languageClient) {
    response = await languageClient.sendRequest(DEBUGGER_EXCEPTION_BREAKPOINTS);
  }
  return Promise.resolve(response);
}

async function registerTestView(
  testOutlineProvider: ApexTestOutlineProvider
): Promise<vscode.Disposable> {
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
      testOutlineProvider.runApexTests()
    )
  );
  // Show Error Message command
  testViewItems.push(
    vscode.commands.registerCommand('sfdx.force.test.view.showError', test =>
      testOutlineProvider.showErrorMessage(test)
    )
  );
  // Run Single Test command
  testViewItems.push(
    vscode.commands.registerCommand(
      'sfdx.force.test.view.runSingleTest',
      test => testOutlineProvider.runSingleTest(test)
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

export function isLanguageClientReady(): boolean {
  return languageClientReady;
}

// tslint:disable-next-line:no-empty
export function deactivate() {
  telemetryService.sendExtensionDeactivationEvent();
}
