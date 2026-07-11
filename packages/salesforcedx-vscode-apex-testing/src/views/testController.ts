/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Equal from 'effect/Equal';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { APEX_TESTING_SCHEME, isForeignOrgClassUri } from '../discoveryVfs/apexTestingDiscoveryFs';
import { nls } from '../messages';
import { getApexTestingRuntime } from '../services/extensionProvider';
import { notificationService } from '../utils/notificationHelpers';
import { getOrgApexClassProvider } from '../utils/orgApexClassProvider';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { isClass, isMethod, isSuite } from '../utils/testItemUtils';
import { getMethodLocationsFromSymbols } from '../utils/testUtils';
import { ApexTestExecutionService, type ApexTestRunScope, type ExecutionContext } from './apexTestExecutionService';
import { ApexTestTreeService, type DiscoveryContext, type TreeMutationContext } from './apexTestTreeService';

const TEST_CONTROLLER_ID = 'sf.apex.testController';

/** Apex test class name for the given file URI, if it is a known test class. Reads the live class-items
 * map from ApexTestTreeService (single source of truth) via a synchronous Ref read. */
export const getTestClassName = (uri: URI): string | undefined => {
  const uriStr = uri.toString();
  const classItems = getApexTestingRuntime().runSync(ApexTestTreeService.getClassItems());
  for (const [className, item] of classItems) {
    if (item.uri?.toString() === uriStr) {
      return className;
    }
  }
  return undefined;
};

/** Clear all suite children so they re-query from the org (delegates to the tree service). */
export const clearAllSuiteChildren = (): void =>
  getApexTestingRuntime().runSync(ApexTestTreeService.clearAllSuiteChildren());

export class ApexTestController {
  private controller: vscode.TestController;
  private inWorkspaceTag: vscode.TestTag | undefined;
  private orgOnlyTag: vscode.TestTag | undefined;
  private suiteTag: vscode.TestTag | undefined;
  private staleTag: vscode.TestTag | undefined;
  private readonly sessionStartTime = Date.now();

  constructor() {
    this.controller = vscode.tests.createTestController(TEST_CONTROLLER_ID, nls.localize('test_view_name'));
    // Create a tag for tests that exist in both workspace and org (enables filtering in Test Explorer)
    this.inWorkspaceTag = new vscode.TestTag('in-workspace');
    // Create a tag for org-only tests (tests that exist in org but not in local workspace)
    this.orgOnlyTag = new vscode.TestTag('org-only');
    // Create a tag for test suites
    this.suiteTag = new vscode.TestTag('test-suite');
    // Create tag for result freshness (accessibility/filtering)
    this.staleTag = new vscode.TestTag('stale');
    this.setupRunProfiles();
    this.setupRefreshHandler();
    this.setupResolveHandler();
  }

  public getController(): vscode.TestController {
    return this.controller;
  }

  public async refresh(): Promise<void> {
    await this.resetState();
    await this.discoverTests();
  }

  /**
   * Clears all test items without re-discovering. Used to reach the no-org state
   * (e.g. logout / delete default org) without requiring a window reload.
   */
  public async clearAllTestItems(): Promise<void> {
    await this.resetState();
  }

  /** Drop the connection/caches, empty the tree, and re-arm result restoration for the next discovery. */
  private async resetState(): Promise<void> {
    getOrgApexClassProvider().clearAllCache();
    this.clearTestItems();
    await getApexTestingRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        // Drop the shared cached connection so the next getConnection() reloads AuthInfo from disk.
        yield* api.services.ConnectionService.invalidateCachedConnections();
        yield* ApexTestTreeService.clearRestoredResults();
      })
    );
  }

  /** Build the per-invocation runtime data the tree service needs (vscode objects + shell callbacks). */
  private buildDiscoveryContext(): DiscoveryContext {
    return {
      controller: this.controller,
      suiteTag: this.suiteTag,
      orgOnlyTag: this.orgOnlyTag,
      inWorkspaceTag: this.inWorkspaceTag,
      sessionStartTime: this.sessionStartTime,
      clearTree: () => this.clearTestItems(),
      updateTestResults: (uri: URI) =>
        getApexTestingRuntime().runPromise(
          ApexTestExecutionService.updateTestResults(this.buildExecutionContext(), uri)
        ),
      staleTag: this.staleTag
    };
  }

  /** Build the per-invocation vscode objects the tree-mutation methods need (controller + tags). */
  private buildTreeMutationContext(): TreeMutationContext {
    return {
      controller: this.controller,
      orgOnlyTag: this.orgOnlyTag,
      inWorkspaceTag: this.inWorkspaceTag,
      staleTag: this.staleTag
    };
  }

  // eslint-disable-next-line class-methods-use-this
  public async clearResults(): Promise<void> {
    void vscode.commands.executeCommand('testing.clearTestResults');

    // Non-fatal: result folder may not exist yet, or deletion may fail. Log + continue.
    await getApexTestingRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const resultDir = yield* getTestResultsFolder();
        yield* api.services.FsService.safeDelete(resultDir, { recursive: true });
      }).pipe(
        Effect.catchTags({
          NoDefaultOrgError: error => Effect.logWarning('Failed to delete test results folder', { error }),
          NoWorkspaceOpenError: error => Effect.logWarning('Failed to delete test results folder', { error }),
          ServicesExtensionNotFoundError: error => Effect.logWarning('Failed to delete test results folder', { error }),
          InvalidServicesApiError: error => Effect.logWarning('Failed to delete test results folder', { error })
        }),
        Effect.withSpan('ApexTestController.clearResults')
      )
    );
  }

  public async discoverTests(): Promise<void> {
    // Single-shot dedup + catchTags-based failure notification live in the tree service (discover).
    await getApexTestingRuntime().runPromise(ApexTestTreeService.discover(this.buildDiscoveryContext()));
  }

  /**
   * Incrementally updates the test tree based on deployed metadata changes (delegated to the tree service).
   * Unlike discoverTests/refresh, this preserves existing test results for unchanged classes.
   */
  public async incrementalUpdate(changes: Map<string, string>, includesSuiteChange: boolean): Promise<void> {
    await getApexTestingRuntime().runPromise(
      ApexTestTreeService.incrementalUpdate(this.buildTreeMutationContext(), changes, includesSuiteChange)
    );
  }

  // Watcher boundary: the execution service owns the dedup (lastProcessedResultFile Ref) + result apply.
  public async onResultFileCreate(apexTestDir: URI, testResultUri: URI): Promise<void> {
    await getApexTestingRuntime().runPromise(
      ApexTestExecutionService.onResultFileCreate(this.buildExecutionContext(), apexTestDir, testResultUri)
    );
  }

  private clearTestItems(): void {
    void vscode.commands.executeCommand('testing.clearTestResults');
    this.controller.items.replace([]);
    // The suite/class/method/classToParent/suiteToClasses maps live in the tree service; reset clears them in place.
    getApexTestingRuntime().runSync(ApexTestTreeService.reset());
  }

  private setupRunProfiles(): void {
    // Default Run uses no profile tag so VS Code applies it to every test in the tree. Tagged profiles are skipped
    // for org-only tests, which incorrectly forced the org-wide profile for "Run all". Workspace-only filtering is
    // applied in runTests for implicit full runs (empty/undefined include), including when the explorer passes the
    // visible/filtered set as include.
    this.controller.createRunProfile(
      nls.localize('run_tests_workspace_default_title'),
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTests(request, token, false, 'workspace-first'),
      true
    );
    this.controller.createRunProfile(
      nls.localize('run_tests_title'),
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTests(request, token, false, 'all-org'),
      false
    );

    this.controller.createRunProfile(
      nls.localize('debug_tests_title'),
      vscode.TestRunProfileKind.Debug,
      (request, token) => this.runTests(request, token, true, 'workspace-first')
    );

    this.controller.createRunProfile(
      nls.localize('run_stale_workspace_tests_title'),
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTests(request, token, false, 'stale-workspace'),
      false,
      this.staleTag
    );

    this.controller.createRunProfile(
      nls.localize('run_stale_org_tests_title'),
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTests(request, token, false, 'stale-org'),
      false,
      this.staleTag
    );
  }

  private setupRefreshHandler(): void {
    this.controller.refreshHandler = async () => {
      await this.refresh();
    };
  }

  /** Sets up the resolve handler for the TestController to lazily load suite children when expanded */
  private setupResolveHandler(): void {
    this.controller.resolveHandler = async (test: vscode.TestItem | undefined) => {
      if (!test) {
        // Resolve all top-level items
        return;
      }

      // If it's a suite, resolve its children (test classes)
      if (isSuite(test.id)) {
        await this.resolveSuiteChildren(test);
      }
      if (isClass(test.id)) {
        await augmentMethodPositionsFromSymbols(test);
      }
    };
  }

  /**
   * Opens an org-only test class in a virtual editor
   */
  // eslint-disable-next-line class-methods-use-this
  public async openOrgOnlyTest(test: vscode.TestItem): Promise<void> {
    return openOrgOnlyTest(test);
  }

  public async retrieveOrgOnlyClass(test: vscode.TestItem): Promise<void> {
    if (!isClass(test.id) || !test.uri) {
      return;
    }
    await this.retrieveOrgOnlyClassFromUri(URI.revive(test.uri));
  }

  public async retrieveOrgOnlyClassFromUri(uri: URI): Promise<void> {
    const className = getClassNameFromApexTestingUri(uri);
    if (!className) {
      return;
    }
    const executionName = nls.localize('apex_test_retrieve_org_only_class_text');
    try {
      const result = await getApexTestingRuntime().runPromise(
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          return yield* api.services.MetadataRetrieveService.retrieve([{ type: 'ApexClass', fullName: className }], {
            ignoreConflicts: true
          });
        })
      );

      if (typeof result === 'string') {
        await notificationService.showInformationMessage(nls.localize('apex_test_retrieve_canceled'));
        return;
      }

      const retrievedFileUri = getRetrievedFileUri(result);
      if (retrievedFileUri) {
        await getApexTestingRuntime().runPromise(
          Effect.fn('ApexTesting.openRetrievedFile')(function* () {
            const api = yield* (yield* ExtensionProviderService).getServicesApi;
            yield* api.services.FsService.showTextDocument(retrievedFileUri, {
              preview: false,
              viewColumn: vscode.ViewColumn.Active,
              preserveFocus: false
            });
            yield* closeEditorTabByUri(uri);
          })()
        );
      }

      try {
        await this.refresh();
      } catch (error: unknown) {
        getApexTestingRuntime().runSync(Effect.logWarning('Failed to refresh Apex tests after retrieve', { error }));
      }

      notificationService.showSuccessfulExecution(executionName);
    } catch {
      notificationService.showFailedExecution(executionName);
    }
  }

  /** Resolve-handler boundary for suite expansion: delegates to the tree service, mapping the tagged
   * ResolveSuiteChildrenError to the legacy user-facing notification message. */
  private async resolveSuiteChildren(suiteItem: vscode.TestItem): Promise<void> {
    const ctx = this.buildTreeMutationContext();
    await getApexTestingRuntime().runPromise(
      ApexTestTreeService.resolveSuiteChildren(ctx, suiteItem).pipe(
        Effect.catchTag('ResolveSuiteChildrenError', error =>
          Effect.sync(
            () =>
              void vscode.window.showErrorMessage(
                nls.localize('apex_test_resolve_suite_children_failed_message', error.suiteName, error.message)
              )
          )
        )
      )
    );
  }

  /** Build the per-invocation runtime data the execution service needs (sibling to buildDiscoveryContext). */
  private buildExecutionContext(): ExecutionContext {
    return {
      controller: this.controller,
      orgOnlyTag: this.orgOnlyTag,
      inWorkspaceTag: this.inWorkspaceTag
    };
  }

  // Single VS Code boundary for the run-profile callback: the execution pipeline stays an Effect until the
  // runPromise here. The service owns gather/scope/expand/execute/debug + result processing.
  private async runTests(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
    isDebug: boolean,
    runScope: ApexTestRunScope
  ): Promise<void> {
    await getApexTestingRuntime().runPromise(
      ApexTestExecutionService.runTests(this.buildExecutionContext(), request, token, isDebug, runScope)
    );
  }

  public dispose(): void {
    this.controller.dispose();
  }
}

// Module-level utility functions extracted from ApexTestController

const augmentMethodPositionsFromSymbols = async (classItem: vscode.TestItem): Promise<void> => {
  if (!classItem.uri) {
    return;
  }
  const unresolved = new Map<string, vscode.TestItem>();
  classItem.children.forEach(child => {
    if (!isMethod(child.id)) {
      return;
    }
    const start = child.range?.start;
    const unresolvedRange = !start || (start.line === 0 && start.character === 0);
    if (unresolvedRange) {
      unresolved.set(child.label, child);
    }
  });
  if (unresolved.size === 0) {
    return;
  }
  const locationMap = await getMethodLocationsFromSymbols(classItem.uri, [...unresolved.keys()]);
  if (!locationMap) {
    return;
  }
  for (const [methodName, location] of locationMap) {
    const item = unresolved.get(methodName);
    if (item) {
      item.range = location.range;
    }
  }
};

const openOrgOnlyTest = async (test: vscode.TestItem): Promise<void> => {
  if (!test.uri) {
    return;
  }
  const testUri = test.uri;
  const editor = await getApexTestingRuntime().runPromise(
    Effect.fn('ApexTesting.openOrgOnlyTest')(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      return yield* api.services.FsService.showTextDocument(testUri, {
        preview: false,
        viewColumn: vscode.ViewColumn.Active
      });
    })()
  );
  if (isMethod(test.id) && test.range) {
    editor.selection = new vscode.Selection(test.range.start, test.range.start);
    editor.revealRange(test.range, vscode.TextEditorRevealType.InCenter);
  }
};

const getClassNameFromApexTestingUri = (uri: URI): string | undefined => {
  if (uri.scheme !== APEX_TESTING_SCHEME) {
    return undefined;
  }
  const classesMarker = '/classes/';
  const markerIndex = uri.path.indexOf(classesMarker);
  if (markerIndex < 0) {
    return undefined;
  }
  const classPath = uri.path.slice(markerIndex + classesMarker.length);
  if (!classPath.endsWith('.cls')) {
    return undefined;
  }
  return classPath.slice(0, -4).replaceAll('/', '.');
};

const getRetrievedFileUri = (result: RetrieveResult): URI | undefined => {
  const filePath = result
    .getFileResponses()
    .find(r => typeof r.filePath === 'string' && r.filePath.length > 0)?.filePath;
  return filePath ? URI.file(filePath) : undefined;
};

// Batch-close text-input tabs matching predicate. No-op on web (tabGroups absent).
const closeMatchingTabs = Effect.fn('ApexTesting.closeMatchingTabs')(function* (predicate: (uri: URI) => boolean) {
  const tabGroupsApi = vscode.window.tabGroups;
  if (!tabGroupsApi) {
    return;
  }
  const tabsToClose = tabGroupsApi.all.flatMap(group =>
    group.tabs.filter(tab => tab.input instanceof vscode.TabInputText && predicate(tab.input.uri))
  );
  if (tabsToClose.length > 0) {
    yield* Effect.promise(() => tabGroupsApi.close(tabsToClose, true));
  }
});

// Close every `apex-testing:` class tab whose org differs from `currentOrgKey`. On a default-org change
// the consumer passes the new orgId, closing the previous org's now-stale tabs; on logout it passes
// `undefined`, so all org tabs are foreign and close. Replaces the old close-all class method so the
// org-change and logout paths share one consumer-driven entry point.
export const closeForeignApexTestingTabs = (currentOrgKey: string | undefined) =>
  closeMatchingTabs(uri => isForeignOrgClassUri(uri, currentOrgKey));

const closeEditorTabByUri = Effect.fn('ApexTesting.closeEditorTabByUri')(function* (uri: URI) {
  // Compare via FsService.HashableUri (structural Equal) rather than hand-rolled toString().
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const HashableUri = yield* api.services.FsService.HashableUri;
  const target = HashableUri.fromUri(uri);
  yield* closeMatchingTabs(tabUri => Equal.equals(HashableUri.fromUri(tabUri), target));
});

let testControllerInst: ApexTestController | undefined;

export const getTestController = (): ApexTestController => {
  testControllerInst ??= new ApexTestController();
  return testControllerInst;
};

/**
 * Disposes the test controller instance (used when switching UI modes)
 */
export const disposeTestController = (): void => {
  if (testControllerInst) {
    testControllerInst.dispose();
    testControllerInst = undefined;
  }
};
