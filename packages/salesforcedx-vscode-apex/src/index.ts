/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ActivationTracker } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import ApexLSPStatusBarItem from './apexLspStatusBarItem';
import { CodeCoverageHandler as CodeCoverage } from './codecoverage/colorizer';
import { StatusBarToggle } from './codecoverage/statusBarToggle';
import { anonApexDebug, anonApexExecute, apexLogGet, launchApexReplayDebuggerWithCurrentFile } from './commands';
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
import { getTelemetryService, setTelemetryService } from './telemetry/telemetry';

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

  if (!vscode.workspace?.workspaceFolders) {
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

  // Commands
  const commands = registerCommands(context);
  context.subscriptions.push(commands);

  const exportedApi: ApexVSCodeApi = {
    getLineBreakpointInfo,
    getExceptionBreakpointInfo,
    getApexTests,
    languageClientManager
  };

  void activationTracker.markActivationStop();

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
  const anonApexRunDelegateCmd = vscode.commands.registerCommand('sf.anon.apex.run.delegate', anonApexExecute);
  const anonApexDebugDelegateCmd = vscode.commands.registerCommand('sf.anon.apex.debug.delegate', anonApexDebug);
  const apexLogGetCmd = vscode.commands.registerCommand('sf.apex.log.get', apexLogGet);
  const anonApexExecuteDocumentCmd = vscode.commands.registerCommand('sf.anon.apex.execute.document', anonApexExecute);
  const anonApexDebugDocumentCmd = vscode.commands.registerCommand('sf.apex.debug.document', anonApexDebug);
  const anonApexExecuteSelectionCmd = vscode.commands.registerCommand(
    'sf.anon.apex.execute.selection',
    anonApexExecute
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
    apexLogGetCmd,
    apexToggleColorizerCmd,
    launchApexReplayDebuggerWithCurrentFileCmd,
    restartApexLanguageServerCmd
  );
};

export const deactivate = async () => {
  await languageClientManager.getClientInstance()?.stop();
  getTelemetryService().sendExtensionDeactivationEvent();
};

export type {
  ApexClassOASEligibleRequestForLSPProtocol,
  ApexClassOASEligibleResponseForLSPProtocol
} from './apexLanguageClient';
export type { LanguageClientManager } from './languageUtils/languageClientManager';

// Export OAS schema types for other extensions to consume
export type {
  ApexClassOASEligibleRequest,
  ApexClassOASEligibleResponse,
  ApexClassOASEligibleResponses,
  ApexOASEligiblePayload,
  ApexClassOASGatherContextResponse,
  ApexOASClassDetail,
  ApexOASPropertyDetail,
  ApexOASMethodDetail,
  ApexOASInterface,
  ApexAnnotationDetail
} from './oasSchemas';

export type ApexVSCodeApi = {
  getLineBreakpointInfo: typeof getLineBreakpointInfo;
  getExceptionBreakpointInfo: typeof getExceptionBreakpointInfo;
  getApexTests: typeof getApexTests;
  languageClientManager: typeof languageClientManager;
};
