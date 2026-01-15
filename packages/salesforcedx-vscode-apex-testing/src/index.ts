/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
import { telemetryService } from './telemetry/telemetry';
import { ActivationTracker } from './utils/activationTracker';
import { getUriPath } from './utils/commandletHelpers';
import { getOrgApexClassProvider } from './utils/orgApexClassProvider';
import { getTestResultsFolder } from './utils/pathHelpers';
import { disposeTestController, getTestController } from './views/testController';
import { getTestOutlineProvider } from './views/testOutlineProvider';

/** Refresh the test view */
const refreshTestView = async (): Promise<void> => {
  const testOutlineProvider = getTestOutlineProvider();
  await testOutlineProvider.refresh();
};

export const activate = async (context: vscode.ExtensionContext) => {
  console.log('Salesforce Apex Testing extension is activating...');

  // Telemetry
  await telemetryService.initializeService(context);
  const activationTracker = new ActivationTracker(context, telemetryService);

  // Set context keys for command visibility
  // Check if we're in a Salesforce project
  let isSalesforceProject = false;
  if (vscode.workspace?.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
    try {
      // Check for sfdx-project.json or sf-project.json
      const sfdxProjectUri = vscode.Uri.joinPath(workspaceUri, 'sfdx-project.json');
      const sfdxExists = await vscode.workspace.fs.stat(sfdxProjectUri).then(
        () => true,
        () => false
      );
      isSalesforceProject = sfdxExists;
    } catch {
      // If we can't check, assume false
      isSalesforceProject = false;
    }
  }
  await vscode.commands.executeCommand('setContext', 'sf:project_opened', isSalesforceProject);

  const testOutlineProvider = getTestOutlineProvider();
  const testController = getTestController();
  console.log('[Apex Testing] Test controller created');

  if (vscode.workspace?.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
    // In web mode, only set up file watchers if we have a file scheme workspace
    // Virtual file systems (memfs, etc.) don't support fsPath and file operations the same way
    if (process.env.ESBUILD_PLATFORM !== 'web' || workspaceUri.scheme === 'file') {
      const workspacePath = getUriPath(workspaceUri);
      if (workspacePath) {
        const apexDirPath = await getTestResultsFolder(workspacePath, 'apex');
        const testResultFileWatcher = vscode.workspace.createFileSystemWatcher(path.join(apexDirPath, '*.json'));
        testResultFileWatcher.onDidCreate(uri => {
          void testOutlineProvider.onResultFileCreate(apexDirPath, uri.fsPath || uri.path);
          void testController.onResultFileCreate(apexDirPath, uri.fsPath || uri.path);
        });
        testResultFileWatcher.onDidChange(uri => {
          void testOutlineProvider.onResultFileCreate(apexDirPath, uri.fsPath || uri.path);
          void testController.onResultFileCreate(apexDirPath, uri.fsPath || uri.path);
        });

        context.subscriptions.push(testResultFileWatcher);
      }
    }

    // Watch for .cls file changes to automatically refresh test discovery
    // This ensures newly created test classes appear in the Test Explorer
    const apexClassFileWatcher = vscode.workspace.createFileSystemWatcher('**/*.cls');
    let refreshTimeout: NodeJS.Timeout | undefined;
    const debouncedRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      // Debounce to avoid too many refreshes when multiple files change
      refreshTimeout = setTimeout(() => {
        void testController.refresh();
      }, 1000);
    };
    apexClassFileWatcher.onDidCreate(() => {
      debouncedRefresh();
    });
    apexClassFileWatcher.onDidChange(() => {
      debouncedRefresh();
    });
    context.subscriptions.push(apexClassFileWatcher);

    // Initialize test discovery for TestController
    testController.discoverTests().catch(error => {
      console.error('Test discovery failed (this is OK if no connection yet):', error);
      // Don't throw - test discovery can fail if there's no authenticated connection yet
    });
  }

  // Register virtual document provider for org-only Apex classes
  const orgApexClassProvider = getOrgApexClassProvider();
  const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
    'sf-org-apex',
    orgApexClassProvider
  );
  context.subscriptions.push(providerRegistration);

  // Register command to open org-only tests
  const openOrgOnlyTestCmd = vscode.commands.registerCommand(
    'sf.apex.test.openOrgOnlyTest',
    async (test: vscode.TestItem) => {
      await getTestController().openOrgOnlyTest(test);
    }
  );
  context.subscriptions.push(openOrgOnlyTestCmd);

  // Commands
  const commands = registerCommands(context);
  context.subscriptions.push(commands);

  // Initial refresh of test view to populate tests when extension activates
  void refreshTestViewOnActivation();

  void activationTracker.markActivationStop();

  console.log('Salesforce Apex Testing extension is now active!');

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

const refreshTestViewOnActivation = async (): Promise<void> => {
  try {
    await refreshTestView();
  } catch (error) {
    // Ignore errors if Apex extension isn't ready yet
    console.debug('Failed to refresh test outline on activation:', error);
  }
};

export const deactivate = () => {
  // Dispose test controller if it exists
  disposeTestController();
  telemetryService.sendExtensionDeactivationEvent();
};

export type ApexTestingVSCodeApi = {
  getTestOutlineProvider: () => ReturnType<typeof getTestOutlineProvider>;
  getTestClassName: (uri: vscode.Uri) => Promise<string | undefined>;
};
