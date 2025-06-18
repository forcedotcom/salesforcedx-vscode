/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getTestResultsFolder, ActivationTracker } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import type { SalesforceVSCodeCoreApi } from 'salesforcedx-vscode-core';
import * as vscode from 'vscode';
import ApexLSPStatusBarItem from './apexLspStatusBarItem';
import { CodeCoverage, StatusBarToggle } from './codecoverage';
import {
  anonApexDebug,
  anonApexExecute,
  apexDebugClassRunCodeActionDelegate,
  apexDebugMethodRunCodeActionDelegate,
  apexLogGet,
  apexTestClassRunCodeAction,
  apexTestClassRunCodeActionDelegate,
  apexTestMethodRunCodeAction,
  apexTestMethodRunCodeActionDelegate,
  apexTestRun,
  apexTestSuiteAdd,
  apexTestSuiteCreate,
  apexTestSuiteRun,
  createApexActionFromClass,
  validateOpenApiDocument,
  launchApexReplayDebuggerWithCurrentFile,
  ApexActionController
} from './commands';
import { MetadataOrchestrator } from './commands/metadataOrchestrator';
import { languageServerOrphanHandler as lsoh } from './languageServerOrphanHandler';
import {
  configureApexLanguage,
  getApexTests,
  getExceptionBreakpointInfo,
  getLineBreakpointInfo,
  languageClientManager,
  restartLanguageServerAndClient,
  createLanguageClient
} from './languageUtils';
import { nls } from './messages';
import { checkIfESRIsDecomposed } from './oasUtils';
import { getTelemetryService, setTelemetryService } from './telemetry/telemetry';
import { getTestOutlineProvider, TestNode } from './views/testOutlineProvider';
import { ApexTestRunner, TestRunType } from './views/testRunner';

const metadataOrchestrator = new MetadataOrchestrator();
const vscodeCoreExtension = vscode.extensions.getExtension<SalesforceVSCodeCoreApi>(
  'salesforce.salesforcedx-vscode-core'
);
if (!vscodeCoreExtension) {
  throw new Error('Could not fetch a SalesforceVSCodeCoreApi instance');
}

// Apex Action Controller
export const apexActionController = new ApexActionController(metadataOrchestrator);

export const activate = async (context: vscode.ExtensionContext) => {
  if (!vscodeCoreExtension.isActive) {
    await vscodeCoreExtension.activate();
  }
  const workspaceContext = vscodeCoreExtension.exports.WorkspaceContext.getInstance();

  // Telemetry
  const telemetryService = vscodeCoreExtension.exports.services.TelemetryService.getInstance();
  await telemetryService.initializeService(context);
  if (!telemetryService) {
    throw new Error('Could not fetch a telemetry service instance');
  }
  setTelemetryService(telemetryService);

  const activationTracker = new ActivationTracker(context, telemetryService);

  const testOutlineProvider = getTestOutlineProvider();
  if (vscode.workspace?.workspaceFolders) {
    const apexDirPath = await getTestResultsFolder(vscode.workspace.workspaceFolders[0].uri.fsPath, 'apex');
    const testResultFileWatcher = vscode.workspace.createFileSystemWatcher(path.join(apexDirPath, '*.json'));
    testResultFileWatcher.onDidCreate(uri => testOutlineProvider.onResultFileCreate(apexDirPath, uri.fsPath));
    testResultFileWatcher.onDidChange(uri => testOutlineProvider.onResultFileCreate(apexDirPath, uri.fsPath));

    context.subscriptions.push(testResultFileWatcher);
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }

  // Workspace Context
  await workspaceContext.initialize(context);

  // start the language server and client
  const languageServerStatusBarItem = new ApexLSPStatusBarItem();
  languageClientManager.setStatusBarInstance(languageServerStatusBarItem);
  await createLanguageClient(context, languageServerStatusBarItem);

  // Javadoc support
  configureApexLanguage();

  // Initialize the apexActionController
  await apexActionController.initialize(context);

  // Initialize if ESR xml is decomposed
  void vscode.commands.executeCommand('setContext', 'sf:is_esr_decomposed', await checkIfESRIsDecomposed());

  // Set context based on mulesoft extension
  const muleDxApiExtension = vscode.extensions.getExtension('salesforce.mule-dx-agentforce-api-component');
  await vscode.commands.executeCommand('setContext', 'sf:muleDxApiInactive', !muleDxApiExtension?.isActive);

  // Commands
  const commands = registerCommands(context);
  context.subscriptions.push(commands, registerTestView());

  const exportedApi: ApexVSCodeApi = {
    getLineBreakpointInfo,
    getExceptionBreakpointInfo,
    getApexTests,
    languageClientManager
  };

  void activationTracker.markActivationStop(new Date());

  setImmediate(() => {
    // Resolve any found orphan language servers in the background
    void lsoh.resolveAnyFoundOrphanLanguageServers();
  });

  return exportedApi;
};

const registerCommands = (context: vscode.ExtensionContext): vscode.Disposable => {
  // Colorize code coverage
  const statusBarToggle = new StatusBarToggle();
  const colorizer = new CodeCoverage(statusBarToggle);
  const apexToggleColorizerCmd = vscode.commands.registerCommand('sf.apex.toggle.colorizer', () =>
    colorizer.toggleCoverage()
  );

  // Customer-facing commands
  const apexTestClassRunDelegateCmd = vscode.commands.registerCommand(
    'sf.apex.test.class.run.delegate',
    apexTestClassRunCodeActionDelegate
  );
  const apexTestLastClassRunCmd = vscode.commands.registerCommand(
    'sf.apex.test.last.class.run',
    apexTestClassRunCodeAction
  );
  const apexTestClassRunCmd = vscode.commands.registerCommand('sf.apex.test.class.run', apexTestClassRunCodeAction);
  const apexTestMethodRunDelegateCmd = vscode.commands.registerCommand(
    'sf.apex.test.method.run.delegate',
    apexTestMethodRunCodeActionDelegate
  );
  const apexDebugClassRunDelegateCmd = vscode.commands.registerCommand(
    'sf.apex.debug.class.run.delegate',
    apexDebugClassRunCodeActionDelegate
  );
  const apexDebugMethodRunDelegateCmd = vscode.commands.registerCommand(
    'sf.apex.debug.method.run.delegate',
    apexDebugMethodRunCodeActionDelegate
  );
  const anonApexRunDelegateCmd = vscode.commands.registerCommand('sf.anon.apex.run.delegate', anonApexExecute);
  const anonApexDebugDelegateCmd = vscode.commands.registerCommand('sf.anon.apex.debug.delegate', anonApexDebug);
  const apexLogGetCmd = vscode.commands.registerCommand('sf.apex.log.get', apexLogGet);
  const apexTestLastMethodRunCmd = vscode.commands.registerCommand(
    'sf.apex.test.last.method.run',
    apexTestMethodRunCodeAction
  );
  const apexTestMethodRunCmd = vscode.commands.registerCommand('sf.apex.test.method.run', apexTestMethodRunCodeAction);
  const apexTestSuiteCreateCmd = vscode.commands.registerCommand('sf.apex.test.suite.create', apexTestSuiteCreate);
  const apexTestSuiteRunCmd = vscode.commands.registerCommand('sf.apex.test.suite.run', apexTestSuiteRun);
  const apexTestSuiteAddCmd = vscode.commands.registerCommand('sf.apex.test.suite.add', apexTestSuiteAdd);
  const apexTestRunCmd = vscode.commands.registerCommand('sf.apex.test.run', apexTestRun);
  const anonApexExecuteDocumentCmd = vscode.commands.registerCommand('sf.anon.apex.execute.document', anonApexExecute);
  const anonApexDebugDocumentCmd = vscode.commands.registerCommand('sf.apex.debug.document', anonApexDebug);
  const anonApexExecuteSelectionCmd = vscode.commands.registerCommand(
    'sf.anon.apex.execute.selection',
    anonApexExecute
  );
  const createApexActionFromClassCmd = vscode.commands.registerCommand(
    'sf.create.apex.action.class',
    createApexActionFromClass
  );
  const validateOpenApiDocumentCmd = vscode.commands.registerCommand(
    'sf.validate.oas.document',
    validateOpenApiDocument
  );
  const launchApexReplayDebuggerWithCurrentFileCmd = vscode.commands.registerCommand(
    'sf.launch.apex.replay.debugger.with.current.file',
    launchApexReplayDebuggerWithCurrentFile
  );
  const restartApexLanguageServerCmd = vscode.commands.registerCommand(
    'sf.apex.languageServer.restart',
    async (source?: 'commandPalette' | 'statusBar') => {
      await restartLanguageServerAndClient(context, source ?? 'commandPalette');
    }
  );

  return vscode.Disposable.from(
    anonApexDebugDelegateCmd,
    anonApexDebugDocumentCmd,
    anonApexExecuteDocumentCmd,
    anonApexExecuteSelectionCmd,
    anonApexRunDelegateCmd,
    apexDebugClassRunDelegateCmd,
    apexDebugMethodRunDelegateCmd,
    apexLogGetCmd,
    apexTestClassRunCmd,
    apexTestClassRunDelegateCmd,
    apexTestLastClassRunCmd,
    apexTestLastMethodRunCmd,
    apexTestMethodRunCmd,
    apexTestMethodRunDelegateCmd,
    apexTestRunCmd,
    apexToggleColorizerCmd,
    apexTestSuiteCreateCmd,
    apexTestSuiteRunCmd,
    apexTestSuiteAddCmd,
    createApexActionFromClassCmd,
    validateOpenApiDocumentCmd,
    launchApexReplayDebuggerWithCurrentFileCmd,
    restartApexLanguageServerCmd
  );
};

const registerTestView = (): vscode.Disposable => {
  const testOutlineProvider = getTestOutlineProvider();
  // Create TestRunner
  const testRunner = new ApexTestRunner(testOutlineProvider);

  // Test View
  const testViewItems: vscode.Disposable[] = [
    vscode.window.registerTreeDataProvider(testOutlineProvider.getId(), testOutlineProvider),
    // Run Test Button on Test View command
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.run`, () => testRunner.runAllApexTests()),
    // Show Error Message command
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.showError`, (test: TestNode) =>
      testRunner.showErrorMessage(test)
    ),
    // Show Definition command
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.goToDefinition`, (test: TestNode) =>
      testRunner.showErrorMessage(test)
    ),
    // Run Class Tests command
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.runClassTests`, (test: TestNode) =>
      testRunner.runApexTests([test.name], TestRunType.Class)
    ),
    // Run Single Test command
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.runSingleTest`, (test: TestNode) =>
      testRunner.runApexTests([test.name], TestRunType.Method)
    ),
    // Refresh Test View command
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.refresh`, () => {
      if (languageClientManager.getStatus().isReady()) {
        return testOutlineProvider.refresh();
      }
    }),
    // Collapse All Apex Tests command
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.collapseAll`, () =>
      testOutlineProvider.collapseAll()
    )
  ];

  return vscode.Disposable.from(...testViewItems);
};

export const deactivate = async () => {
  await languageClientManager.getClientInstance()?.stop();
  getTelemetryService().sendExtensionDeactivationEvent();
};

export type ApexVSCodeApi = {
  getLineBreakpointInfo: typeof getLineBreakpointInfo;
  getExceptionBreakpointInfo: typeof getExceptionBreakpointInfo;
  getApexTests: typeof getApexTests;
  languageClientManager: typeof languageClientManager;
};
