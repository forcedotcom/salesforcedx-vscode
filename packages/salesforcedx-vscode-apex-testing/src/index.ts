/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { initializeOutputChannel } from './channels';
import { CodeCoverageHandler } from './codecoverage/colorizer';
import { StatusBarToggle } from './codecoverage/statusBarToggle';
import {
  apexDebugClassRunCodeActionDelegate,
  apexDebugMethodRunCodeActionDelegate,
  apexTestClassRunCodeAction,
  apexTestClassRunCodeActionDelegate,
  apexGenerateUnitTestClassCommand,
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
import { registerOrgOnlyRetrieveCodeLensProvider } from './retrieve/orgOnlyRetrieveCodeLensProvider';
import {
  buildAllServicesLayer,
  getApexTestingRuntime,
  setAllServicesLayer
} from './services/extensionProvider';
import { telemetryService } from './telemetry/telemetry';
import { getOrgApexClassProvider } from './utils/orgApexClassProvider';
import { disposeTestController, getTestController } from './views/testController';

/** File change event from FileWatcherService */
type FileChangeEvent = {
  readonly type: 'create' | 'change' | 'delete';
  readonly uri: URI;
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
    const targetOrgRef = yield* api.services.TargetOrgRef();
    const connectionService = yield* api.services.ConnectionService;

    const channelService = yield* api.services.ChannelService;
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
        Stream.tap((org: { username?: string; orgId?: string }) =>
          !org.orgId ? connectionService.getConnection() : Effect.void
        ),
        Stream.filter(hasOrgConnected),
        // Deduplicate: only emit when org key changes
        Stream.filterEffect((org: { username?: string; orgId?: string }) => {
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
        Stream.tap((org: { username?: string; orgId?: string }) =>
          channelService.appendToChannel(`Target org changed to ${JSON.stringify(org)}`)
        ),
        Stream.tap((org: { username?: string; orgId?: string }) =>
          channelService.appendToChannel(`Discovering tests for org: ${org.username ?? org.orgId}`)
        ),
        Stream.runForEach(discoverForOrg)
      )
    );

    // Trigger connection which populates the TargetOrgRef, then discover tests
    // This handles the startup case where the ref is empty
    yield* connectionService.getConnection();
  }).pipe(
    Effect.catchAll(error => {
      console.debug('[Apex Testing] Test discovery setup failed:', error);
      return Effect.void;
    })
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
const setupTestResultsFileWatcher = (testController: ReturnType<typeof getTestController>) =>
  Effect.gen(function* () {
    const api = yield* (yield* ExtensionProviderService).getServicesApi;
    const fileWatcherService = yield* api.services.FileWatcherService;

    // Subscribe to file events and filter for test result JSON files
    yield* Effect.forkDaemon(
      Stream.fromPubSub(fileWatcherService.pubsub).pipe(
        Stream.filter(isTestResultJsonFile),
        Stream.runForEach(event => {
          const apexDirUri = Utils.dirname(event.uri);
          void testController.onResultFileCreate(apexDirUri, event.uri);
          return Effect.void;
        })
      )
    );
  });

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

    // Set up file watcher for test result JSON files using FileWatcherService
    yield* setupTestResultsFileWatcher(testController);

    // Initialize test discovery when an org is available, and re-discover on org changes (runs in background)
    yield* Effect.forkDaemon(initializeTestDiscovery(testController));

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

  // Always register commands (they'll be no-ops if not in a project)
  const registerCommand = api.services.registerCommandWithRuntime(getApexTestingRuntime());
  yield* registerCommand('sf.apex.generate.unit.test.class', (outputDir?: URI) =>
    apexGenerateUnitTestClassCommand(undefined, outputDir)
  );
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
  return getApexTestingRuntime().runPromise(
    activateEffect(context).pipe(
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
  const retrieveOrgOnlyClassCmd = vscode.commands.registerCommand(
    'sf.apex.test.orgOnlyClass.retrieve',
    async (target?: vscode.TestItem | vscode.Uri) => {
      if (!target) {
        const activeUri = vscode.window.activeTextEditor?.document.uri;
        if (activeUri?.scheme === APEX_TESTING_SCHEME) {
          await getTestController().retrieveOrgOnlyClassFromUri(activeUri);
        }
        return;
      }
      if ('scheme' in target) {
        await getTestController().retrieveOrgOnlyClassFromUri(target);
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
    retrieveOrgOnlyClassCmd,
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
  disposeTestController();
  telemetryService.sendExtensionDeactivationEvent();
};

export type ApexTestingVSCodeApi = {
  getTestClassName: (uri: URI) => Promise<string | undefined>;
};
