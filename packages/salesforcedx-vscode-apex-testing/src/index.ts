/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { closeExtensionScope, ExtensionProviderService, getExtensionScope } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Scope from 'effect/Scope';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { initializeOutputChannel } from './channels';
import { CodeCoverageHandler } from './codecoverage/colorizer';
import { StatusBarToggle } from './codecoverage/statusBarToggle';
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
import { buildAllServicesLayer, getApexTestingRuntime, setAllServicesLayer } from './services/extensionProvider';
import { telemetryService } from './telemetry/telemetry';
import { getOrgApexClassProvider } from './utils/orgApexClassProvider';
import { disposeTestController, getTestController } from './views/testController';
import { setupApexMetadataChangeWatcher } from './watchers/apexMetadataChangeWatcher';
import { initializeTestDiscovery } from './watchers/testDiscovery';
import { setupTestResultsFileWatcher } from './watchers/testResultsFileWatcher';

/** Effect-based activation that provides automatic timing via span */
const activateEffect = Effect.fn('apex-testing.activation')(function* (context: vscode.ExtensionContext) {
  yield* Effect.log('Salesforce Apex Testing extension is activating...');

  // Initialize the shared output channel from services API
  yield* initializeOutputChannel;

  // Check if we're in a Salesforce project (also sets VS Code context as side effect)
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const projectService = yield* api.services.ProjectService;
  const isSalesforceProject = yield* projectService.isSalesforceProject();

  // Only set up project-specific features if we're in a Salesforce project
  if (isSalesforceProject) {
    const testController = getTestController();
    yield* Effect.log('[Apex Testing] Test controller created');

    const scope = yield* getExtensionScope();
    yield* Effect.all(
      [
        Effect.forkIn(setupTestResultsFileWatcher(testController), scope),
        Effect.forkIn(setupApexMetadataChangeWatcher(testController), scope),
        Effect.forkIn(initializeTestDiscovery(testController), scope)
      ],
      { concurrency: 'unbounded' }
    );

    // Register virtual document provider for org-only Apex classes
    const orgApexClassProvider = getOrgApexClassProvider();
    const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
      'sf-org-apex',
      orgApexClassProvider
    );
    context.subscriptions.push(providerRegistration);
  }

  // Always register commands (they'll be no-ops if not in a project)
  const commands = registerCommands();
  context.subscriptions.push(commands);

  yield* Effect.log('Salesforce Apex Testing extension is now active!');

  // Export API for other extensions to consume
  return {
    getTestClassName: async (uri: URI): Promise<string | undefined> => {
      try {
        const controller = getTestController();
        return controller.getTestClassName(uri);
      } catch (error) {
        console.debug('Failed to get test class name:', error);
        return undefined;
      }
    }
  };
});

export const activate = (context: vscode.ExtensionContext) => {
  setAllServicesLayer(buildAllServicesLayer(context));
  const extensionScope = getApexTestingRuntime().runSync(getExtensionScope());
  return getApexTestingRuntime().runPromise(
    activateEffect(context).pipe(
      Scope.extend(extensionScope),
      Effect.catchAll(error => {
        console.error('[Apex Testing] Activation failed:', error);
        return Effect.succeed({
          getTestClassName: async (_uri: URI) => undefined
        });
      })
    )
  );
};

const registerCommands = (): vscode.Disposable => {
  // Code coverage highlighting (owned by Apex Testing; works in Desktop and Web)
  const statusBarToggle = new StatusBarToggle();
  const colorizer = new CodeCoverageHandler(statusBarToggle);
  const apexToggleColorizerCmd = vscode.commands.registerCommand('sf.apex.toggle.colorizer', () =>
    colorizer.toggleCoverage()
  );

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
  const openOrgOnlyTestCmd = vscode.commands.registerCommand(
    'sf.apex.test.openOrgOnlyTest',
    async (test: vscode.TestItem) => {
      await getTestController().openOrgOnlyTest(test);
    }
  );
  const apexTestRefreshCmd = vscode.commands.registerCommand('sf.apex.test.refresh', async () => {
    await getTestController().refresh();
  });
  const apexTestingWalkthroughOpenCmd = vscode.commands.registerCommand('sf.apex.testing.walkthrough.open', () =>
    vscode.commands.executeCommand(
      'workbench.action.openWalkthrough',
      'salesforce.salesforcedx-vscode-apex-testing#sf.apex.testing.explorer',
      false
    )
  );

  return vscode.Disposable.from(
    apexToggleColorizerCmd,
    statusBarToggle,
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
    apexTestSuiteAddCmd,
    openOrgOnlyTestCmd,
    apexTestRefreshCmd,
    apexTestingWalkthroughOpenCmd
  );
};

export const deactivate = () => {
  void getApexTestingRuntime().runPromise(closeExtensionScope());
  disposeTestController();
  telemetryService.sendExtensionDeactivationEvent();
};

export type ApexTestingVSCodeApi = {
  getTestClassName: (uri: URI) => Promise<string | undefined>;
};
