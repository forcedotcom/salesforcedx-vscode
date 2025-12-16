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
import { useTestExplorer } from './testDiscovery/testDiscovery';
import { getOrgApexClassProvider } from './utils/orgApexClassProvider';
import { getLanguageClientStatus } from './utils/testUtils';
import { disposeTestController, getTestController } from './views/testController';
import { getTestOutlineProvider, TestNode } from './views/testOutlineProvider';
import { ApexTestRunner, TestRunType } from './views/testRunner';

/** Refresh the test view, checking language client status if using LS discovery */
const refreshTestView = async (): Promise<void> => {
  const testOutlineProvider = getTestOutlineProvider();
  const config = vscode.workspace.getConfiguration('salesforcedx-vscode-apex-testing');
  const source = config.get<'ls' | 'api'>('discoverySource', 'ls');
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

  const useTestExplorerMode = useTestExplorer();
  const testOutlineProvider = getTestOutlineProvider();
  // Only create test controller if Test Explorer mode is enabled
  const testController = useTestExplorerMode ? getTestController() : undefined;

  if (vscode.workspace?.workspaceFolders) {
    const apexDirPath = await getTestResultsFolder(vscode.workspace.workspaceFolders[0].uri.fsPath, 'apex');
    const testResultFileWatcher = vscode.workspace.createFileSystemWatcher(path.join(apexDirPath, '*.json'));
    testResultFileWatcher.onDidCreate(uri => {
      void testOutlineProvider.onResultFileCreate(apexDirPath, uri.fsPath);
      if (useTestExplorerMode && testController) {
        void testController.onResultFileCreate(apexDirPath, uri.fsPath);
      }
    });
    testResultFileWatcher.onDidChange(uri => {
      void testOutlineProvider.onResultFileCreate(apexDirPath, uri.fsPath);
      if (useTestExplorerMode && testController) {
        void testController.onResultFileCreate(apexDirPath, uri.fsPath);
      }
    });

    context.subscriptions.push(testResultFileWatcher);

    // Watch for .cls file changes to automatically refresh test discovery
    // This ensures newly created test classes appear in the Test Explorer
    if (useTestExplorerMode) {
      const apexClassFileWatcher = vscode.workspace.createFileSystemWatcher('**/*.cls');
      let refreshTimeout: NodeJS.Timeout | undefined;
      const debouncedRefresh = () => {
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }
        // Debounce to avoid too many refreshes when multiple files change
        refreshTimeout = setTimeout(() => {
          if (testController) {
            void testController.refresh();
          }
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
      if (testController) {
        void testController.discoverTests();
      }
    }
  } else {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }

  // Workspace Context
  await workspaceContext.initialize(context);

  // Store the test view disposable so we can dispose it when switching modes
  let testViewDisposable: vscode.Disposable | undefined;

  // Register settings change handler for test discovery source and test UI mode
  const testDiscoverySettingsWatcher = vscode.workspace.onDidChangeConfiguration(async event => {
    if (event.affectsConfiguration('salesforcedx-vscode-apex-testing.discoverySource')) {
      try {
        await (useTestExplorer() ? getTestController().refresh() : refreshTestView());
      } catch (error) {
        // Ignore errors if Apex extension isn't ready yet
        console.debug('Failed to refresh test outline after settings change:', error);
      }
    }
    if (event.affectsConfiguration('salesforcedx-vscode-apex-testing.useTestExplorer')) {
      // When switching modes, dispose old controller and initialize the new one
      const newUseTestExplorerMode = useTestExplorer();
      try {
        if (newUseTestExplorerMode) {
          // Switching to Test Explorer - dispose old view and controller, then create and initialize new one
          if (testViewDisposable) {
            testViewDisposable.dispose();
            testViewDisposable = undefined;
          }
          disposeTestController();
          void getTestController().discoverTests();
          // The old view will be hidden automatically via the when clause in package.json
        } else {
          // Switching to old view - dispose test controller and register old view
          disposeTestController();
          if (!testViewDisposable) {
            testViewDisposable = registerTestView();
            context.subscriptions.push(testViewDisposable);
          }
          await getTestOutlineProvider().refresh();
          // The old view will be shown automatically via the when clause in package.json
        }
      } catch (error) {
        console.debug('Failed to refresh after UI mode change:', error);
      }
    }
  });
  context.subscriptions.push(testDiscoverySettingsWatcher);

  // Register virtual document provider for org-only Apex classes
  if (useTestExplorerMode) {
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
  }

  // Commands
  const commands = registerCommands(context);
  // Only register the old test view if not using Test Explorer
  if (!useTestExplorerMode) {
    testViewDisposable = registerTestView();
    context.subscriptions.push(testViewDisposable);
  }
  context.subscriptions.push(commands);

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
  // Dispose test controller if it exists
  disposeTestController();
  telemetryService.sendExtensionDeactivationEvent();
};

export type ApexTestingVSCodeApi = {
  getTestOutlineProvider: () => ReturnType<typeof getTestOutlineProvider>;
  getTestClassName: (uri: vscode.Uri) => Promise<string | undefined>;
};
