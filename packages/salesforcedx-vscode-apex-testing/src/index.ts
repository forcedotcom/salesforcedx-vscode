/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  buildAllServicesLayer,
  closeExtensionScope,
  ExtensionProviderService,
  getExtensionScope
} from '@salesforce/effect-ext-utils';
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
  apexTestLastClassRunCodeAction,
  apexTestLastMethodRunCodeAction,
  apexTestMethodRunCodeAction,
  apexTestMethodRunCodeActionDelegate,
  apexTestRun,
  apexTestSuiteAdd,
  apexTestSuiteCreate,
  apexTestSuiteRun
} from './commands';
import { ApexTestingDecorationProvider } from './discoveryVfs/apexTestingDecorationProvider';
import { APEX_TESTING_SCHEME } from './discoveryVfs/apexTestingDiscoveryFs';
import { getApexTestingDiscoveryFsProvider } from './discoveryVfs/apexTestingDiscoveryFsProvider';
import { nls } from './messages';
import { registerOrgOnlyRetrieveCodeLensProvider } from './retrieve/orgOnlyRetrieveCodeLensProvider';
import { getApexTestingRuntime, setAllServicesLayer } from './services/extensionProvider';
import { telemetryService } from './telemetry/telemetry';
import { apexTestingDiagnostics } from './utils/diagnostics';
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

    const discoveryFsRegistration = vscode.workspace.registerFileSystemProvider(
      APEX_TESTING_SCHEME,
      getApexTestingDiscoveryFsProvider(),
      { isCaseSensitive: true, isReadonly: true }
    );
    context.subscriptions.push(discoveryFsRegistration);

    const decorationRegistration = vscode.window.registerFileDecorationProvider(new ApexTestingDecorationProvider());
    context.subscriptions.push(decorationRegistration);

    registerOrgOnlyRetrieveCodeLensProvider(context);
  }

  // Register Effect-pipeline commands via the runtime so spans/tracing/error-handling and
  // UserCancellationError swallowing are wired by registerCommandWithRuntime.
  const registerCommand = api.services.registerCommandWithRuntime(getApexTestingRuntime());
  yield* Effect.all([
    registerCommand('sf.apex.test.run', apexTestRun),
    registerCommand('sf.apex.test.suite.add', apexTestSuiteAdd),
    registerCommand('sf.apex.test.suite.create', apexTestSuiteCreate),
    registerCommand('sf.apex.test.suite.run', apexTestSuiteRun),
    registerCommand('sf.apex.test.class.run', apexTestClassRunCodeAction),
    registerCommand('sf.apex.test.last.class.run', apexTestLastClassRunCodeAction),
    registerCommand('sf.apex.test.method.run', apexTestMethodRunCodeAction),
    registerCommand('sf.apex.test.last.method.run', apexTestLastMethodRunCodeAction)
  ]);

  // Always register the remaining (non-Effect) commands (they'll be no-ops if not in a project)
  const commands = registerCommands();
  // apexTestingDiagnostics: single shared diagnostic collection for apex test failures
  context.subscriptions.push(commands, apexTestingDiagnostics);

  yield* Effect.log('Salesforce Apex Testing extension is now active!');

  // Export API for other extensions to consume
  return {
    getTestClassName: (uri: URI): Promise<string | undefined> => {
      try {
        const controller = getTestController();
        return Promise.resolve(controller.getTestClassName(uri));
      } catch (error) {
        console.debug('Failed to get test class name:', error);
        return Promise.resolve(undefined);
      }
    }
  };
});

export const activate = (context: vscode.ExtensionContext) => {
  setAllServicesLayer(buildAllServicesLayer(context, nls.localize('channel_name')));
  const extensionScope = getApexTestingRuntime().runSync(getExtensionScope());

  return getApexTestingRuntime().runPromise(
    activateEffect(context).pipe(
      Scope.extend(extensionScope),
      Effect.catchAll(error => {
        console.error('[Apex Testing] Activation failed:', error);
        return Effect.succeed({
          getTestClassName: (_uri: URI) => Promise.resolve(undefined)
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
  const apexTestMethodRunDelegateCmd = vscode.commands.registerCommand(
    'sf.apex.test.method.run.delegate',
    apexTestMethodRunCodeActionDelegate
  );
  const apexDebugMethodRunDelegateCmd = vscode.commands.registerCommand(
    'sf.apex.debug.method.run.delegate',
    apexDebugMethodRunCodeActionDelegate
  );
  const retrieveOrgOnlyClassCmd = vscode.commands.registerCommand(
    'sf.apex.test.orgOnlyClass.retrieve',
    async (target?: vscode.TestItem | URI) => {
      if (!target) {
        const activeUri = vscode.window.activeTextEditor?.document.uri;
        if (activeUri?.scheme === APEX_TESTING_SCHEME) {
          await getTestController().retrieveOrgOnlyClassFromUri(URI.revive(activeUri));
        }
        return;
      }
      if ('scheme' in target) {
        await getTestController().retrieveOrgOnlyClassFromUri(URI.revive(target));
        return;
      }
      await getTestController().retrieveOrgOnlyClass(target);
    }
  );
  const openOrgOnlyTestCmd = vscode.commands.registerCommand(
    'sf.apex.test.openOrgOnlyTest',
    async (test: vscode.TestItem) => {
      await getTestController().openOrgOnlyTest(test);
    }
  );
  const apexTestRefreshCmd = vscode.commands.registerCommand('sf.apex.test.refresh', async () => {
    await getTestController().refresh();
  });
  const apexTestClearResultsCmd = vscode.commands.registerCommand('sf.apex.test.results.clear', async () => {
    await getTestController().clearResults();
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
    apexTestClassRunDelegateCmd,
    apexDebugClassRunDelegateCmd,
    apexTestMethodRunDelegateCmd,
    apexDebugMethodRunDelegateCmd,
    retrieveOrgOnlyClassCmd,
    openOrgOnlyTestCmd,
    apexTestRefreshCmd,
    apexTestClearResultsCmd,
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
