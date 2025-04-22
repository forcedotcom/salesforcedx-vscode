/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getTestResultsFolder, ActivationTracker } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
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
  createApexActionFromMethod,
  createApexActionFromClass,
  validateOpenApiDocument,
  launchApexReplayDebuggerWithCurrentFile,
  ApexActionController
} from './commands';
import { MetadataOrchestrator } from './commands/metadataOrchestrator';
import { workspaceContext } from './context';
import { languageServerOrphanHandler as lsoh } from './languageServerOrphanHandler';
import {
  configureApexLanguage,
  getApexTests,
  getExceptionBreakpointInfo,
  getLineBreakpointInfo,
  languageClientManager
} from './languageUtils';
import { restartLanguageServerAndClient, createLanguageClient } from './languageUtils';
import { nls } from './messages';
import { checkIfESRIsDecomposed } from './oasUtils';
import { getTelemetryService } from './telemetry/telemetry';
import { getTestOutlineProvider, TestNode } from './views/testOutlineProvider';
import { ApexTestRunner, TestRunType } from './views/testRunner';

const metadataOrchestrator = new MetadataOrchestrator();
let extensionContext: vscode.ExtensionContext;

// Apex Action Controller
export const apexActionController = new ApexActionController(metadataOrchestrator);

export const activate = async (context: vscode.ExtensionContext) => {
  extensionContext = context;
  const telemetryService = await getTelemetryService();
  if (!telemetryService) {
    throw new Error('Could not fetch a telemetry service instance');
  }

  // Telemetry
  await telemetryService.initializeService(extensionContext);

  const activationTracker = new ActivationTracker(extensionContext, telemetryService);

  const testOutlineProvider = getTestOutlineProvider();
  if (vscode.workspace && vscode.workspace.workspaceFolders) {
    const apexDirPath = getTestResultsFolder(vscode.workspace.workspaceFolders[0].uri.fsPath, 'apex');

    const testResultOutput = path.join(apexDirPath, '*.json');
    const testResultFileWatcher = vscode.workspace.createFileSystemWatcher(testResultOutput);
    testResultFileWatcher.onDidCreate(uri => testOutlineProvider.onResultFileCreate(apexDirPath, uri.fsPath));
    testResultFileWatcher.onDidChange(uri => testOutlineProvider.onResultFileCreate(apexDirPath, uri.fsPath));

    extensionContext.subscriptions.push(testResultFileWatcher);
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }

  // Workspace Context
  await workspaceContext.initialize(extensionContext);

  // start the language server and client
  const languageServerStatusBarItem = new ApexLSPStatusBarItem();
  languageClientManager.setStatusBarInstance(languageServerStatusBarItem);
  await createLanguageClient(extensionContext, languageServerStatusBarItem);

  // Javadoc support
  configureApexLanguage();

  // Initialize the apexActionController
  await apexActionController.initialize(extensionContext);

  const isESRDecomposed = await checkIfESRIsDecomposed();
  // Initialize if ESR xml is decomposed
  void vscode.commands.executeCommand('setContext', 'sf:is_esr_decomposed', isESRDecomposed);

  const muleDxApiExtension = vscode.extensions.getExtension('salesforce.mule-dx-agentforce-api-component');

  // Set context based on mulesoft extension
  if (!muleDxApiExtension?.isActive) {
    await vscode.commands.executeCommand('setContext', 'sf:muleDxApiInactive', true);
  } else {
    await vscode.commands.executeCommand('setContext', 'sf:muleDxApiInactive', false);
  }
  // Commands
  const commands = registerCommands();
  extensionContext.subscriptions.push(commands);

  extensionContext.subscriptions.push(registerTestView());

  const exportedApi = {
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

const registerCommands = (): vscode.Disposable => {
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
  const createApexActionFromMethodCmd = vscode.commands.registerCommand(
    'sf.create.apex.action.method',
    createApexActionFromMethod
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
  const restartApexLanguageServerCmd = vscode.commands.registerCommand('sf.apex.languageServer.restart', async () => {
    await restartLanguageServerAndClient(extensionContext);
  });

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
    createApexActionFromMethodCmd,
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
  const testViewItems = new Array<vscode.Disposable>();

  const testProvider = vscode.window.registerTreeDataProvider(testOutlineProvider.getId(), testOutlineProvider);
  testViewItems.push(testProvider);

  // Run Test Button on Test View command
  testViewItems.push(
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.run`, () => testRunner.runAllApexTests())
  );
  // Show Error Message command
  testViewItems.push(
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.showError`, (test: TestNode) =>
      testRunner.showErrorMessage(test)
    )
  );
  // Show Definition command
  testViewItems.push(
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.goToDefinition`, (test: TestNode) =>
      testRunner.showErrorMessage(test)
    )
  );
  // Run Class Tests command
  testViewItems.push(
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.runClassTests`, (test: TestNode) =>
      testRunner.runApexTests([test.name], TestRunType.Class)
    )
  );
  // Run Single Test command
  testViewItems.push(
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.runSingleTest`, (test: TestNode) =>
      testRunner.runApexTests([test.name], TestRunType.Method)
    )
  );
  // Refresh Test View command
  testViewItems.push(
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.refresh`, () => {
      if (languageClientManager.getStatus().isReady()) {
        return testOutlineProvider.refresh();
      }
    })
  );
  // Collapse All Apex Tests command
  testViewItems.push(
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.collapseAll`, () =>
      testOutlineProvider.collapseAll()
    )
  );

  return vscode.Disposable.from(...testViewItems);
};

export const deactivate = async () => {
  await languageClientManager.getClientInstance()?.stop();
  const telemetryService = await getTelemetryService();
  telemetryService?.sendExtensionDeactivationEvent();
};
