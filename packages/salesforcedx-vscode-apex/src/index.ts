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
import { CodeCoverageHandler as CodeCoverage } from './codecoverage/colorizer';
import { StatusBarToggle } from './codecoverage/statusBarToggle';
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
import { getVscodeCoreExtension } from './coreExtensionUtils';
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

// Apex Action Controller
export const apexActionController = new ApexActionController(metadataOrchestrator);

export const activate = async (context: vscode.ExtensionContext) => {
  const vscodeCoreExtension = await getVscodeCoreExtension();
  const workspaceContext = vscodeCoreExtension.exports.WorkspaceContext.getInstance();

  // Telemetry
  const { name } = context.extension.packageJSON;
  const telemetryService = vscodeCoreExtension.exports.services.TelemetryService.getInstance(name);
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

  // Register settings change handler for LSP parity capabilities
  const lspParitySettingsWatcher = vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('salesforcedx-vscode-apex.advanced.lspParityCapabilities')) {
      void vscode.commands.executeCommand('sf.apex.languageServer.restart', 'commandPalette');
    }
  });
  context.subscriptions.push(lspParitySettingsWatcher);

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
  context.subscriptions.push(registerCommands(context), registerTestView());

  void activationTracker.markActivationStop();

  setImmediate(() => {
    // Resolve any found orphan language servers in the background
    void lsoh.resolveAnyFoundOrphanLanguageServers();
  });

  return {
    getLineBreakpointInfo,
    getExceptionBreakpointInfo,
    getApexTests,
    languageClientManager
  };
};

const registerCommands = (context: vscode.ExtensionContext): vscode.Disposable =>
  vscode.Disposable.from(
    vscode.commands.registerCommand('sf.anon.apex.debug.delegate', anonApexDebug),
    vscode.commands.registerCommand('sf.apex.debug.document', anonApexDebug),
    vscode.commands.registerCommand('sf.anon.apex.execute.document', anonApexExecute),
    vscode.commands.registerCommand('sf.anon.apex.execute.selection', anonApexExecute),
    vscode.commands.registerCommand('sf.anon.apex.run.delegate', anonApexExecute),
    vscode.commands.registerCommand('sf.apex.debug.class.run.delegate', apexDebugClassRunCodeActionDelegate),
    vscode.commands.registerCommand('sf.apex.debug.method.run.delegate', apexDebugMethodRunCodeActionDelegate),
    vscode.commands.registerCommand('sf.apex.log.get', apexLogGet),
    vscode.commands.registerCommand('sf.apex.test.class.run', apexTestClassRunCodeAction),
    vscode.commands.registerCommand('sf.apex.test.class.run.delegate', apexTestClassRunCodeActionDelegate),
    vscode.commands.registerCommand('sf.apex.test.last.class.run', apexTestClassRunCodeAction),
    vscode.commands.registerCommand('sf.apex.test.last.method.run', apexTestMethodRunCodeAction),
    vscode.commands.registerCommand('sf.apex.test.method.run', apexTestMethodRunCodeAction),
    vscode.commands.registerCommand('sf.apex.test.method.run.delegate', apexTestMethodRunCodeActionDelegate),
    vscode.commands.registerCommand('sf.apex.test.run', apexTestRun),
    vscode.commands.registerCommand('sf.apex.toggle.colorizer', () =>
      new CodeCoverage(new StatusBarToggle()).toggleCoverage()
    ),
    vscode.commands.registerCommand('sf.apex.test.suite.create', apexTestSuiteCreate),
    vscode.commands.registerCommand('sf.apex.test.suite.run', apexTestSuiteRun),
    vscode.commands.registerCommand('sf.apex.test.suite.add', apexTestSuiteAdd),
    vscode.commands.registerCommand('sf.create.apex.action.class', createApexActionFromClass),
    vscode.commands.registerCommand('sf.validate.oas.document', validateOpenApiDocument),
    vscode.commands.registerCommand(
      'sf.launch.apex.replay.debugger.with.current.file',
      launchApexReplayDebuggerWithCurrentFile
    ),
    vscode.commands.registerCommand(
      'sf.apex.languageServer.restart',
      async (source?: 'commandPalette' | 'statusBar') => {
        await restartLanguageServerAndClient(context, source ?? 'commandPalette');
      }
    )
  );
const registerTestView = (): vscode.Disposable => {
  const testOutlineProvider = getTestOutlineProvider();
  // Create TestRunner
  const testRunner = new ApexTestRunner(testOutlineProvider);

  // Test View

  return vscode.Disposable.from(
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
  );
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
