/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ActivationTracker, getTestResultsFolder } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import {
  apexDebugClassRunCodeActionDelegate,
  apexDebugMethodRunCodeActionDelegate,
  apexTestClassRunCodeAction,
  apexTestClassRunCodeActionDelegate,
  apexTestMethodRunCodeAction,
  apexTestMethodRunCodeActionDelegate,
  apexTestRun,
  apexTestSuiteAdd,
  apexTestSuiteCreate,
  apexTestSuiteRun
} from './commands';
import { getVscodeCoreExtension } from './coreExtensionUtils';
import { nls } from './messages';
import { telemetryService } from './telemetry/telemetry';
import { getLanguageClientStatus } from './utils/testUtils';
import { getTestOutlineProvider, TestNode } from './views/testOutlineProvider';
import { ApexTestRunner, TestRunType } from './views/testRunner';

/** Refresh the test view, checking language client status if using LS discovery */
const refreshTestView = async (): Promise<void> => {
  const testOutlineProvider = getTestOutlineProvider();
  const config = vscode.workspace.getConfiguration('salesforcedx-vscode-apex');
  const source = config.get<'ls' | 'api'>('testing.discoverySource', 'ls');
  if (source === 'ls') {
    const languageClientStatus = await getLanguageClientStatus();
    if (languageClientStatus.isReady()) {
      await testOutlineProvider.refresh();
    } else {
      vscode.window.showErrorMessage(
        nls.localize('test_view_refresh_failed_message', languageClientStatus.getStatusMessage())
      );
    }
  } else {
    await testOutlineProvider.refresh();
  }
};

export const activate = async (context: vscode.ExtensionContext) => {
  const vscodeCoreExtension = await getVscodeCoreExtension();
  const workspaceContext = vscodeCoreExtension.exports.WorkspaceContext.getInstance();

  // Telemetry
  await telemetryService.initializeService(context);
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

  // Register settings change handler for test discovery source
  const testDiscoverySettingsWatcher = vscode.workspace.onDidChangeConfiguration(async event => {
    if (event.affectsConfiguration('salesforcedx-vscode-apex.testing.discoverySource')) {
      try {
        await refreshTestView();
      } catch (error) {
        // Ignore errors if Apex extension isn't ready yet
        console.debug('Failed to refresh test outline after settings change:', error);
      }
    }
  });
  context.subscriptions.push(testDiscoverySettingsWatcher);

  // Commands
  const commands = registerCommands(context);
  context.subscriptions.push(commands, registerTestView());

  // Initial refresh of test view to populate tests when extension activates
  void refreshTestViewOnActivation();

  void activationTracker.markActivationStop();

  // Export API for other extensions to consume
  return {
    getTestOutlineProvider,
    getTestClassName: async (uri: vscode.Uri): Promise<string | undefined> => {
      try {
        const provider = getTestOutlineProvider();
        await provider.refresh();
        return provider.getTestClassName(URI.parse(uri.toString()));
      } catch (error) {
        console.debug('Failed to get test class name:', error);
        return undefined;
      }
    }
  };
};

const registerCommands = (_context: vscode.ExtensionContext): vscode.Disposable => {
  // Customer-facing commands
  const apexTestClassRunDelegateCmd = vscode.commands.registerCommand(
    'sf.apex.test.class.run.delegate',
    apexTestClassRunCodeActionDelegate
  );
  const apexDebugClassRunDelegateCmd = vscode.commands.registerCommand(
    'sf.apex.debug.class.run.delegate',
    apexDebugClassRunCodeActionDelegate
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
  const apexDebugMethodRunDelegateCmd = vscode.commands.registerCommand(
    'sf.apex.debug.method.run.delegate',
    apexDebugMethodRunCodeActionDelegate
  );
  const apexTestLastMethodRunCmd = vscode.commands.registerCommand(
    'sf.apex.test.last.method.run',
    apexTestMethodRunCodeAction
  );
  const apexTestMethodRunCmd = vscode.commands.registerCommand('sf.apex.test.method.run', apexTestMethodRunCodeAction);
  const apexTestSuiteCreateCmd = vscode.commands.registerCommand('sf.apex.test.suite.create', apexTestSuiteCreate);
  const apexTestSuiteRunCmd = vscode.commands.registerCommand('sf.apex.test.suite.run', apexTestSuiteRun);
  const apexTestSuiteAddCmd = vscode.commands.registerCommand('sf.apex.test.suite.add', apexTestSuiteAdd);
  const apexTestRunCmd = vscode.commands.registerCommand('sf.apex.test.run', apexTestRun);

  return vscode.Disposable.from(
    apexTestClassRunCmd,
    apexTestClassRunDelegateCmd,
    apexDebugClassRunDelegateCmd,
    apexTestLastClassRunCmd,
    apexTestLastMethodRunCmd,
    apexTestMethodRunCmd,
    apexTestMethodRunDelegateCmd,
    apexDebugMethodRunDelegateCmd,
    apexTestRunCmd,
    apexTestSuiteCreateCmd,
    apexTestSuiteRunCmd,
    apexTestSuiteAddCmd
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
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.refresh`, async () => {
      try {
        await refreshTestView();
      } catch (error) {
        console.debug('Failed to refresh test view:', error);
      }
    }),
    // Collapse All Apex Tests command
    vscode.commands.registerCommand(`${testOutlineProvider.getId()}.collapseAll`, () =>
      testOutlineProvider.collapseAll()
    )
  ];

  return vscode.Disposable.from(...testViewItems);
};

const refreshTestViewOnActivation = async (): Promise<void> => {
  try {
    await refreshTestView();
  } catch (error) {
    // Ignore errors if Apex extension isn't ready yet
    console.debug('Failed to refresh test outline on activation:', error);
  }
};

export const deactivate = () => {
  telemetryService.sendExtensionDeactivationEvent();
};

export type ApexTestingVSCodeApi = {
  getTestOutlineProvider: () => ReturnType<typeof getTestOutlineProvider>;
  getTestClassName: (uri: vscode.Uri) => Promise<string | undefined>;
};
