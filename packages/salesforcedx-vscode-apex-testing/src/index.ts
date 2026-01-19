/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { initializeOutputChannel } from './channels';
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
import { AllServicesLayer, ExtensionProviderService } from './services/extensionProvider';
import { telemetryService } from './telemetry/telemetry';
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

/** Check if an org is connected by looking at TargetOrgRef */
const hasOrgConnected = (orgInfo: { username?: string; orgId?: string }): boolean =>
  Boolean(orgInfo.username ?? orgInfo.orgId);

/** Initialize test discovery when an org is available, and re-discover on org changes */
const initializeTestDiscovery = (testController: ReturnType<typeof getTestController>): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const targetOrgRef = api.services.TargetOrgRef;
      const connectionService = yield* api.services.ConnectionService;

      // Track last discovered org to avoid duplicate discoveries
      let lastDiscoveredOrg: string | undefined;

      const discoverForOrg = (orgInfo: { username?: string; orgId?: string }) =>
        Effect.gen(function* () {
          const orgKey = orgInfo.username ?? orgInfo.orgId;
          // Skip if we already discovered for this org
          if (orgKey && orgKey === lastDiscoveredOrg) {
            return;
          }
          lastDiscoveredOrg = orgKey;
          console.log(`[Apex Testing] Discovering tests for org: ${orgKey}`);
          yield* Effect.promise(() => testController.discoverTests());
        });

      // Subscribe to org changes and re-discover tests when org changes
      yield* Effect.fork(
        Stream.changes(targetOrgRef).pipe(Stream.filter(hasOrgConnected), Stream.runForEach(discoverForOrg))
      );

      // Trigger connection which populates the TargetOrgRef, then discover tests
      // This handles the startup case where the ref is empty
      yield* connectionService.getConnection.pipe(
        Effect.flatMap(() => SubscriptionRef.get(targetOrgRef)),
        Effect.flatMap(orgInfo => (hasOrgConnected(orgInfo) ? discoverForOrg(orgInfo) : Effect.void)),
        Effect.catchAll(error => {
          console.debug('[Apex Testing] Initial connection failed (no org configured?):', error);
          return Effect.void;
        })
      );
    }).pipe(
      Effect.catchAll(error => {
        console.debug('[Apex Testing] Test discovery setup failed:', error);
        return Effect.void;
      }),
      Effect.provide(AllServicesLayer)
    )
  );

/** Effect-based activation that provides automatic timing via span */
const activateEffect = (context: vscode.ExtensionContext) =>
  Effect.gen(function* () {
    yield* Effect.log('Salesforce Apex Testing extension is activating...');

    // Initialize the shared output channel from services API
    yield* Effect.promise(() => initializeOutputChannel());

    // Check if we're in a Salesforce project and set context (side effect of isSalesforceProject)
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const projectService = yield* api.services.ProjectService;
    yield* projectService.isSalesforceProject.pipe(Effect.catchAll(() => Effect.void));

    const testOutlineProvider = getTestOutlineProvider();
    const testController = getTestController();
    yield* Effect.log('[Apex Testing] Test controller created');

    if (vscode.workspace?.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
      // In web mode, only set up file watchers if we have a file scheme workspace
      // Virtual file systems (memfs, etc.) don't support fsPath and file operations the same way
      if (process.env.ESBUILD_PLATFORM !== 'web' || workspaceUri.scheme === 'file') {
        const workspacePath = getUriPath(workspaceUri);
        if (workspacePath) {
          const apexDirPath = yield* Effect.promise(() => getTestResultsFolder(workspacePath, 'apex'));
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

      // Initialize test discovery when an org is available, and re-discover on org changes
      void initializeTestDiscovery(testController);
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

    yield* Effect.log('Salesforce Apex Testing extension is now active!');

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
  }).pipe(Effect.withSpan('apex-testing.activation'), Effect.provide(AllServicesLayer));

export const activate = (context: vscode.ExtensionContext) => Effect.runPromise(activateEffect(context));

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
  disposeTestController();
  telemetryService.sendExtensionDeactivationEvent();
};

export type ApexTestingVSCodeApi = {
  getTestOutlineProvider: () => ReturnType<typeof getTestOutlineProvider>;
  getTestClassName: (uri: vscode.Uri) => Promise<string | undefined>;
};
