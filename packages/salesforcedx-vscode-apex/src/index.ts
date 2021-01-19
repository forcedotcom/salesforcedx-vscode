/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TestRunner } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient } from 'vscode-languageclient/lib/main';
import { CodeCoverage, StatusBarToggle } from './codecoverage';
import {
  checkSObjectsAndRefresh,
  forceApexDebugClassRunCodeActionDelegate,
  forceApexDebugMethodRunCodeActionDelegate,
  forceApexTestClassRunCodeAction,
  forceApexTestClassRunCodeActionDelegate,
  forceApexTestMethodRunCodeAction,
  forceApexTestMethodRunCodeActionDelegate,
  forceGenerateFauxClassesCreate,
  initSObjectDefinitions
} from './commands';
import {
  ENABLE_SOBJECT_REFRESH_ON_STARTUP,
  SFDX_APEX_CONFIGURATION_NAME
} from './constants';
import { workspaceContext } from './context';
import {
  ClientStatus,
  enableJavaDocSymbols,
  getApexTests,
  getExceptionBreakpointInfo,
  getLineBreakpointInfo,
  languageClientUtils
} from './languageClientUtils';
import * as languageServer from './languageServer';
import { nls } from './messages';
import { telemetryService } from './telemetry';
import { ApexTestOutlineProvider } from './views/testOutlineProvider';
import { ApexTestRunner, TestRunType } from './views/testRunner';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const coreTelemetryService = sfdxCoreExports.telemetryService;

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

  // Workspace Context
  await workspaceContext.initialize(context);

  // Telemetry
  telemetryService.initializeService(
    coreTelemetryService.getReporter(),
    coreTelemetryService.isTelemetryEnabled()
  );

  // Initialize Apex language server
  try {
    const langClientHRStart = process.hrtime();
    languageClient = await languageServer.createLanguageServer(context);
    languageClientUtils.setClientInstance(languageClient);
    const handle = languageClient.start();
    languageClientUtils.setStatus(ClientStatus.Indexing, '');
    context.subscriptions.push(handle);

    languageClient
      .onReady()
      .then(async () => {
        if (languageClient) {
          languageClient.onNotification('indexer/done', async () => {
            // Refresh SObject definitions if there aren't any faux classes
            const sobjectRefreshStartup: boolean = vscode.workspace
              .getConfiguration(SFDX_APEX_CONFIGURATION_NAME)
              .get<boolean>(ENABLE_SOBJECT_REFRESH_ON_STARTUP, false);

            if (sobjectRefreshStartup) {
              initSObjectDefinitions(
                vscode.workspace.workspaceFolders![0].uri.fsPath
              ).catch(e =>
                telemetryService.sendErrorEvent({
                  message: e.message,
                  stack: e.stack
                })
              );
            } else {
              checkSObjectsAndRefresh(
                vscode.workspace.workspaceFolders![0].uri.fsPath
              ).catch(e =>
                telemetryService.sendErrorEvent({
                  message: e.message,
                  stack: e.stack
                })
              );
            }
            await testOutlineProvider.refresh();
          });
        }
        // TODO: This currently keeps existing behavior in which we set the language
        // server to ready before it finishes indexing. We'll evaluate this in the future.
        languageClientUtils.setStatus(ClientStatus.Ready, '');
        telemetryService.sendApexLSPActivationEvent(langClientHRStart);
      })
      .catch(err => {
        // Handled by clients
        telemetryService.sendApexLSPError(err);
        languageClientUtils.setStatus(
          ClientStatus.Error,
          nls.localize('apex_language_server_failed_activate')
        );
      });
  } catch (e) {
    console.error('Apex language server failed to initialize');
    languageClientUtils.setStatus(ClientStatus.Error, e);
  }

  // Javadoc support
  enableJavaDocSymbols();

  // Commands
  const commands = registerCommands(context);
  context.subscriptions.push(commands);

  context.subscriptions.push(await registerTestView(testOutlineProvider));

  const exportedApi = {
    getLineBreakpointInfo,
    getExceptionBreakpointInfo,
    getApexTests,
    languageClientUtils
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
  const forceApexToggleColorizerCmd = vscode.commands.registerCommand(
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
  const forceApexDebugClassRunDelegateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.debug.class.run.delegate',
    forceApexDebugClassRunCodeActionDelegate
  );
  const forceApexDebugMethodRunDelegateCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.debug.method.run.delegate',
    forceApexDebugMethodRunCodeActionDelegate
  );
  const forceApexTestLastMethodRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.last.method.run',
    forceApexTestMethodRunCodeAction
  );
  const forceApexTestMethodRunCmd = vscode.commands.registerCommand(
    'sfdx.force.apex.test.method.run',
    forceApexTestMethodRunCodeAction
  );
  const forceGenerateFauxClassesCmd = vscode.commands.registerCommand(
    'sfdx.force.internal.refreshsobjects',
    forceGenerateFauxClassesCreate
  );
  return vscode.Disposable.from(
    forceApexToggleColorizerCmd,
    forceApexTestLastClassRunCmd,
    forceApexTestClassRunCmd,
    forceApexTestClassRunDelegateCmd,
    forceApexDebugClassRunDelegateCmd,
    forceApexDebugMethodRunDelegateCmd,
    forceApexTestLastMethodRunCmd,
    forceApexTestMethodRunCmd,
    forceApexTestMethodRunDelegateCmd,
    forceGenerateFauxClassesCmd
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
      if (languageClientUtils.getStatus().isReady()) {
        return testOutlineProvider.refresh();
      }
    })
  );

  return vscode.Disposable.from(...testViewItems);
}

export function deactivate() {
  telemetryService.sendExtensionDeactivationEvent();
}
