/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';

/** File change event from FileWatcherService */
type FileChangeEvent = {
  readonly type: 'create' | 'change' | 'delete';
  readonly uri: vscode.Uri;
};
import { channelService, initializeOutputChannel } from './channels';
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
import { getOrgApexClassProvider } from './utils/orgApexClassProvider';
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

/** Helper to get a unique key for an org (for deduplication) */
const getOrgKey = (orgInfo: { username?: string; orgId?: string }): string | undefined =>
  orgInfo.username ?? orgInfo.orgId;

/** Initialize test discovery when an org is available, and re-discover on org changes */
const initializeTestDiscovery = (testController: ReturnType<typeof getTestController>) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const targetOrgRef = api.services.TargetOrgRef;
    const connectionService = yield* api.services.ConnectionService;

    // Track the last discovered org key to prevent duplicate discoveries
    const lastDiscoveredOrgRef = yield* Ref.make<string | undefined>(undefined);

    const discoverForOrg = (orgInfo: { username?: string; orgId?: string }) =>
      Effect.gen(function* () {
        const orgKey = getOrgKey(orgInfo);
        console.log(`[Apex Testing] Discovering tests for org: ${orgKey}`);
        yield* Effect.promise(() => testController.discoverTests());
      });

    // Subscribe to org changes and re-discover tests when org changes
    // Use filterEffect with Ref to deduplicate at stream level
    yield* Effect.forkDaemon(
      targetOrgRef.changes.pipe(
        // if we don't have an orgId, try to get the connection to cause another event to fire with it
        Stream.tap(org => (!org.orgId ? connectionService.getConnection : Effect.succeed(undefined))),
        Stream.filter(hasOrgConnected),
        // Deduplicate: only emit when org key changes
        Stream.filterEffect(org => {
          const currentKey = getOrgKey(org);
          return Effect.gen(function* () {
            const lastKey = yield* Ref.get(lastDiscoveredOrgRef);
            if (currentKey === lastKey) {
              return false; // Skip duplicate
            }
            yield* Ref.set(lastDiscoveredOrgRef, currentKey);
            return true; // Emit this org
          });
        }),
        // Log after deduplication so we only see unique org changes
        Stream.tap(org =>
          Effect.promise(() => channelService.appendLine(`Target org changed to ${JSON.stringify(org)}`))
        ),
        Stream.tap(org =>
          Effect.promise(() => channelService.appendLine(`Discovering tests for org: ${org.username ?? org.orgId}`))
        ),
        Stream.runForEach(discoverForOrg)
      )
    );

    // Trigger connection which populates the TargetOrgRef, then discover tests
    // This handles the startup case where the ref is empty
    yield* connectionService.getConnection;
  }).pipe(
    Effect.catchAll(error => {
      console.debug('[Apex Testing] Test discovery setup failed:', error);
      return Effect.void;
    }),
    Effect.provide(AllServicesLayer)
  );

/** Normalize path separators to forward slashes for cross-platform comparison */
const normalizePath = (p: string): string => p.replaceAll('\\', '/');

/** Check if a file event is a test result JSON file */
const isTestResultJsonFile = (event: FileChangeEvent): boolean => {
  const uriPath = normalizePath(event.uri.path || event.uri.fsPath);
  return (
    (event.type === 'create' || event.type === 'change') &&
    uriPath.includes('.sfdx/tools/testresults/apex') &&
    uriPath.endsWith('.json')
  );
};

/** Set up file watcher for test result JSON files using FileWatcherService */
const setupTestResultsFileWatcher = (
  testOutlineProvider: ReturnType<typeof getTestOutlineProvider>,
  testController: ReturnType<typeof getTestController>
) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const fileWatcherService = yield* api.services.FileWatcherService;

    // Subscribe to file events and filter for test result JSON files
    yield* Effect.forkDaemon(
      Stream.fromPubSub(fileWatcherService.pubsub).pipe(
        Stream.filter(isTestResultJsonFile),
        Stream.runForEach(event => {
          const filePath = event.uri.fsPath ?? event.uri.path;
          // Extract the apex test results directory from the file path (handle both / and \ separators)
          const lastSepIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
          const apexDirPath = filePath.substring(0, lastSepIndex);
          void testOutlineProvider.onResultFileCreate(apexDirPath, filePath);
          void testController.onResultFileCreate(apexDirPath, filePath);
          return Effect.void;
        })
      )
    );
  });

/** Effect-based activation that provides automatic timing via span */
const activateEffect = (context: vscode.ExtensionContext) =>
  Effect.gen(function* () {
    yield* Effect.log('Salesforce Apex Testing extension is activating...');

    // Initialize the shared output channel from services API
    yield* initializeOutputChannel;

    // Check if we're in a Salesforce project (also sets VS Code context as side effect)
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const projectService = yield* api.services.ProjectService;
    const isSalesforceProject = yield* projectService.isSalesforceProject.pipe(
      Effect.catchAll(() => Effect.succeed(false))
    );

    // Only set up project-specific features if we're in a Salesforce project
    if (isSalesforceProject && vscode.workspace?.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const testOutlineProvider = getTestOutlineProvider();
      const testController = getTestController();
      yield* Effect.log('[Apex Testing] Test controller created');

      // Set up file watcher for test result JSON files using FileWatcherService
      yield* setupTestResultsFileWatcher(testOutlineProvider, testController);

      // Initialize test discovery when an org is available, and re-discover on org changes (runs in background)
      yield* Effect.forkDaemon(initializeTestDiscovery(testController));

      // Register virtual document provider for org-only Apex classes
      const orgApexClassProvider = getOrgApexClassProvider();
      const providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
        'sf-org-apex',
        orgApexClassProvider
      );
      context.subscriptions.push(providerRegistration);

      // Initial refresh of test view to populate tests when extension activates (runs in background)
      yield* Effect.forkDaemon(
        Effect.tryPromise(() => refreshTestView()).pipe(
          Effect.tapError(error => Effect.logDebug('Failed to refresh test outline on activation:', error)),
          Effect.catchAll(() => Effect.void)
        )
      );
    }

    // Always register commands (they'll be no-ops if not in a project)
    const commands = registerCommands();
    context.subscriptions.push(commands);

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

const registerCommands = (): vscode.Disposable => {
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
    apexTestSuiteAddCmd,
    openOrgOnlyTestCmd
  );
};

export const deactivate = () => {
  disposeTestController();
  telemetryService.sendExtensionDeactivationEvent();
};

export type ApexTestingVSCodeApi = {
  getTestOutlineProvider: () => ReturnType<typeof getTestOutlineProvider>;
  getTestClassName: (uri: vscode.Uri) => Promise<string | undefined>;
};
