/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/lib/main';
import { CodeCoverage, StatusBarToggle } from './codecoverage';
import {
  forceApexTestClassRunCodeAction,
  forceApexTestClassRunCodeActionDelegate,
  forceApexTestMethodRunCodeAction,
  forceApexTestMethodRunCodeActionDelegate
} from './commands';
import {
  getApexTests,
  getExceptionBreakpointInfo,
  getLineBreakpointInfo,
  isLanguageClientReady,
  LanguageClientUtils
} from './languageClientUtils';
import * as languageServer from './languageServer';
import { nls } from './messages';
import { telemetryService } from './telemetry';
import { ApexTestOutlineProvider } from './views/testOutlineProvider';
import { ApexTestRunner, TestRunType } from './views/testRunner';

const sfdxCoreExtension = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
);

let languageClient: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const extensionHRStart = process.hrtime();
  const testOutlineProvider = new ApexTestOutlineProvider(null);
  if (vscode.workspace && vscode.workspace.workspaceFolders) {
    const apexDirPath = new TestRunner().getTempFolder(
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      'apex'
    );

    const testResultOutput = path.join(apexDirPath, '*.json');
    const testResultFileWatcher = vscode.workspace.createFileSystemWatcher(
      testResultOutput
    );
    testResultFileWatcher.onDidCreate(uri =>
      testOutlineProvider.onResultFileCreate(apexDirPath, uri.fsPath)
    );

    context.subscriptions.push(testResultFileWatcher);
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }

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
      if (languageClient) {
        languageClient.onNotification('indexer/done', async () => {
          LanguageClientUtils.indexing = false;
          await testOutlineProvider.refresh();
        });
      }
      LanguageClientUtils.languageClientReady = true;
      telemetryService.sendApexLSPActivationEvent(langClientHRStart);
    })
    .catch(err => {
      // Handled by clients
      telemetryService.sendApexLSPError(err);
    });

  // Commands
  const commands = registerCommands(context);
  context.subscriptions.push(commands);

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
function registerCommands(
  extensionContext: vscode.ExtensionContext
): vscode.Disposable {
  // Colorize code coverage
  const statusBarToggle = new StatusBarToggle();
  const colorizer = new CodeCoverage(statusBarToggle);

  const colorizerCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.toggle.colorizer',
    () => colorizer.toggleCoverage()
  );

  // Customer-facing commands
  const forceApexTestClassRunDelegateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.class.run.delegate',
    forceApexTestClassRunCodeActionDelegate
  );
  const forceApexTestLastClassRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.last.class.run',
    forceApexTestClassRunCodeAction
  );
  const forceApexTestClassRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.class.run',
    forceApexTestClassRunCodeAction
  );
  const forceApexTestMethodRunDelegateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.method.run.delegate',
    forceApexTestMethodRunCodeActionDelegate
  );
  const forceApexTestLastMethodRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.last.method.run',
    forceApexTestMethodRunCodeAction
  );
  const forceApexTestMethodRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.method.run',
    forceApexTestMethodRunCodeAction
  );
  return vscode.Disposable.from(
    colorizerCmd,
    forceApexTestLastClassRunCmd,
    forceApexTestClassRunCmd,
    forceApexTestClassRunDelegateCmd,
    forceApexTestLastMethodRunCmd,
    forceApexTestMethodRunCmd,
    forceApexTestMethodRunDelegateCmd
  );
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
      testRunner.runAllApexTests()
    )
  );
  // Show Error Message command
  testViewItems.push(
    vscode.commands.registerCommand('sfdx.force.test.view.showError', test =>
      testRunner.showErrorMessage(test)
    )
  );
  // Show Definition command
  testViewItems.push(
    vscode.commands.registerCommand(
      'sfdx.force.test.view.goToDefinition',
      test => testRunner.showErrorMessage(test)
    )
  );
  // Run Class Tests command
  testViewItems.push(
    vscode.commands.registerCommand(
      'sfdx.force.test.view.runClassTests',
      test => testRunner.runApexTests([test.name], TestRunType.Class)
    )
  );
  // Run Single Test command
  testViewItems.push(
    vscode.commands.registerCommand(
      'sfdx.force.test.view.runSingleTest',
      test => testRunner.runApexTests([test.name], TestRunType.Method)
    )
  );
  // Refresh Test View command
  testViewItems.push(
    vscode.commands.registerCommand('sfdx.force.test.view.refresh', () => {
      if (!LanguageClientUtils.indexing) {
        return testOutlineProvider.refresh();
      }
    })
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
