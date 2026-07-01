/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ToolingTestClass } from '../testDiscovery/schemas';
import { TestLevel, TestResult, TestService } from '@salesforce/apex-node';
import type { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { RESULT_MAX_AGE_MS, TEST_ID_PREFIXES } from '../constants';
import { getConnection, getDefaultOrgInfo } from '../coreExtensionUtils';
import { ApexTestDiscoveryService } from '../discoveryVfs/apexTestDiscoveryService';
import { APEX_TESTING_SCHEME } from '../discoveryVfs/apexTestingDiscoveryFs';
import { nls } from '../messages';
import { getApexTestingRuntime } from '../services/extensionProvider';
import * as settings from '../settings';
import { resolvePackage2Members } from '../testDiscovery/packageResolution';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { ApexTestRunCacheService } from '../testRunCache/apexTestRunCacheService';
import { toUserFriendlyApexTestError } from '../utils/apexTestErrorMapper';
import { notificationService } from '../utils/notificationHelpers';
import { getOrgApexClassProvider } from '../utils/orgApexClassProvider';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { buildTestPayload } from '../utils/payloadBuilder';
import { sortByMtimeAscending } from '../utils/sortHelpers';
import {
  createMethodId,
  createNamespaceId,
  createSuiteClassId,
  createSuiteId,
  extractClassName,
  extractSuiteName,
  filterTestItemsByRequestExclude,
  gatherTests,
  getTestName,
  isClass,
  isMethod,
  isSuite,
  isSuiteClass
} from '../utils/testItemUtils';
import { writeAndOpenTestReport } from '../utils/testReportGenerator';
import { updateTestRunResults } from '../utils/testResultProcessor';
import {
  buildClassToUriIndex,
  getMethodLocationsFromSymbols,
  readTestRunIdFile,
  writeTestResultJsonFile
} from '../utils/testUtils';
import { getFullClassName, isFlowTest } from '../utils/toolingTestClassHelpers';
import {
  buildClassIdToNamespace,
  buildNamespacePackageStructure,
  createClassAndMethodsFactory,
  getNamespaceDisplayLabel,
  getPackageKeysOrdered,
  getPackageLabelAndId,
  isNonEmptyClassEntriesList,
  sortNamespaceKeys
} from './orgTestItems';

const TEST_CONTROLLER_ID = 'sf.apex.testController';
const TEST_RESULT_JSON_FILE = 'test-result.json';

/** How the run profile constrains an implicit "run all" (no explicit test selection). */
type ApexTestRunScope = 'workspace-first' | 'all-org' | 'stale-workspace' | 'stale-org';

export class ApexTestController {
  private controller: vscode.TestController;
  private suiteItems: Map<string, vscode.TestItem> = new Map();
  private classItems: Map<string, vscode.TestItem> = new Map();
  private methodItems: Map<string, vscode.TestItem> = new Map();
  private classToParentItem: Map<string, vscode.TestItem> = new Map();
  private hasRestoredResults = false;
  private isRestoringResults = false;
  private discoveryInProgress: Promise<void> | undefined;
  private suiteParentItem: vscode.TestItem | undefined;
  private lastProcessedResultFile: URI | null = null;
  private connection: Connection | undefined;
  private testService: TestService | undefined;
  private suiteToClasses: Map<string, Set<string>> = new Map();
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

  /**
   * Returns the Apex test class name for the given file URI, if it is a known test class in the controller.
   */
  public getTestClassName(uri: URI): string | undefined {
    const uriStr = uri.toString();
    for (const [className, item] of this.classItems) {
      if (item.uri?.toString() === uriStr) {
        return className;
      }
    }
    return undefined;
  }

  public async refresh(): Promise<void> {
    if (this.discoveryInProgress) {
      await this.discoveryInProgress;
      return;
    }
    this.resetState();
    await this.discoverTests();
  }

  /**
   * Clears all test items without re-discovering. Used to reach the no-org state
   * (e.g. logout / delete default org) without requiring a window reload.
   */
  public async clearAllTestItems(): Promise<void> {
    // Unlike refresh(), drain any in-flight discovery without early-returning, then clear so the
    // reset lands after the discovery that would otherwise repopulate the tree.
    if (this.discoveryInProgress) {
      await this.discoveryInProgress;
    }
    this.resetState();
  }

  /** Drop the connection/caches, empty the tree, and re-arm result restoration for the next discovery. */
  private resetState(): void {
    this.invalidateConnection();
    this.clearTestItems();
    this.hasRestoredResults = false;
  }

  // eslint-disable-next-line class-methods-use-this
  public async clearResults(): Promise<void> {
    void vscode.commands.executeCommand('testing.clearTestResults');

    try {
      await getApexTestingRuntime().runPromise(
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          const resultDir = yield* getTestResultsFolder();
          yield* api.services.FsService.safeDelete(resultDir, { recursive: true });
        })
      );
    } catch (error) {
      // Non-fatal: result folder may not exist yet, or deletion may fail
      console.debug('Failed to delete test results folder:', error);
    }
  }

  /**
   * Clears all suite children so they will be re-queried from the org
   */
  public clearAllSuiteChildren(): void {
    for (const suiteItem of this.suiteItems.values()) {
      suiteItem.children.replace([]);
    }
  }

  /**
   * Ensures connection and testService are initialized
   * @throws Error if initialization fails
   */
  private async ensureInitialized(): Promise<void> {
    if (this.connection && this.testService) {
      return;
    }

    this.connection = await getConnection();
    if (!this.connection) {
      throw new Error(nls.localize('apex_test_connection_failed_message'));
    }
    this.testService = new TestService(this.connection);
  }

  /**
   * Gets the test service, throwing if not initialized
   */
  private getTestService(): TestService {
    if (!this.testService) {
      throw new Error(nls.localize('apex_test_service_not_initialized_message'));
    }
    return this.testService;
  }

  /**
   * Gets the connection, throwing if not initialized
   */
  private getConnection(): Connection {
    if (!this.connection) {
      throw new Error(nls.localize('apex_test_connection_not_initialized_message'));
    }
    return this.connection;
  }

  public async discoverTests(): Promise<void> {
    if (this.discoveryInProgress) {
      await this.discoveryInProgress;
      return;
    }
    this.discoveryInProgress = this.doDiscoverTests();
    try {
      await this.discoveryInProgress;
    } finally {
      this.discoveryInProgress = undefined;
    }
  }

  private doDiscoverTestsEffect = Effect.fn('doDiscoverTests')(function* (this: ApexTestController) {
    yield* Effect.tryPromise(() => this.ensureInitialized()).pipe(Effect.withSpan('ensureInitialized'));

    this.clearTestItems();

    yield* Effect.tryPromise(() => this.populateSuiteItems()).pipe(Effect.withSpan('populateSuiteItems'));

    const discoveryResult = yield* discoverTests();

    yield* Effect.tryPromise(() => this.persistDiscoveredClasses(discoveryResult.classes)).pipe(
      Effect.withSpan('persistDiscoveredClasses', {
        attributes: { classCount: discoveryResult.classes.length }
      })
    );

    if (discoveryResult.classes.length > 0) {
      yield* Effect.tryPromise(() => this.populateTestItemsFromOrg(discoveryResult.classes)).pipe(
        Effect.withSpan('populateTestItemsFromOrg', {
          attributes: { classCount: discoveryResult.classes.length }
        })
      );
    }

    if (!this.hasRestoredResults) {
      this.hasRestoredResults = true;
      yield* Effect.tryPromise(() => this.restorePreviousResults()).pipe(Effect.withSpan('restorePreviousResults'));
    }
  });

  private async doDiscoverTests(): Promise<void> {
    await getApexTestingRuntime().runPromise(
      this.doDiscoverTestsEffect.call(this).pipe(
        Effect.catchAll(error =>
          Effect.sync(() => {
            console.debug('Failed to discover tests:', error);
            const friendlyMessage = toUserFriendlyApexTestError(error);
            if (friendlyMessage === nls.localize('apex_test_discovery_partial_warning')) {
              void notificationService.showWarningMessage(friendlyMessage);
            } else {
              void notificationService.showErrorMessage(friendlyMessage);
            }
          })
        )
      )
    );
  }

  private async persistDiscoveredClasses(classes: ToolingTestClass[]): Promise<void> {
    const apexClasses = classes.filter(cls => cls.testMethods?.length > 0 && !isFlowTest(cls));
    const fetchClassBodies = (input: ToolingTestClass[]) => this.fetchClassBodiesByFullName(input);
    // Discovery persistence is best-effort: org-info lookup, class-body fetch, and the VFS write are
    // logged and ignored on failure so they never fail the discovery run (the snapshot is an
    // optimization, not required for the test tree to render).
    await getApexTestingRuntime().runPromise(
      Effect.gen(function* () {
        const { orgId } = yield* Effect.tryPromise(() => getDefaultOrgInfo());
        // No default org → nothing to key the snapshot by; persistence is best-effort, so skip.
        if (!orgId) return;
        const classBodiesByFullName = yield* Effect.tryPromise(() => fetchClassBodies(apexClasses));
        yield* ApexTestDiscoveryService.saveDiscoveredClasses(orgId, apexClasses, classBodiesByFullName);
      }).pipe(
        Effect.catchTags({
          UnknownException: error => Effect.logWarning('failed to persist discovered Apex classes', { error }),
          DiscoveryClearError: error => Effect.logWarning('failed to persist discovered Apex classes', { error })
        }),
        Effect.withSpan('ApexTestController.persistDiscoveredClasses')
      )
    );
  }

  private async fetchClassBodiesByFullName(classes: ToolingTestClass[]): Promise<Map<string, string>> {
    const classIds = classes
      .map(cls => cls.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .toSorted();
    const bodyByFullName = new Map<string, string>();
    if (classIds.length === 0) {
      return bodyByFullName;
    }

    const connection = this.getConnection();
    const chunkSize = 200;
    for (let start = 0; start < classIds.length; start += chunkSize) {
      const chunkIds = classIds.slice(start, start + chunkSize);
      const inClause = chunkIds.map(id => `'${id.replaceAll("'", "''")}'`).join(',');
      const query = `SELECT Id, Name, NamespacePrefix, Body FROM ApexClass WHERE Id IN (${inClause})`;
      const queryResult = await connection.tooling.query<{
        Name: string;
        NamespacePrefix?: string | null;
        Body?: string | null;
      }>(query);
      for (const record of queryResult.records) {
        const fullClassName = record.NamespacePrefix?.trim() ? `${record.NamespacePrefix}.${record.Name}` : record.Name;
        bodyByFullName.set(
          fullClassName,
          record.Body ?? nls.localize('apex_discovery_vfs_class_body_placeholder', fullClassName)
        );
      }
    }

    for (const cls of classes) {
      const fullClassName = getFullClassName(cls);
      if (!bodyByFullName.has(fullClassName)) {
        bodyByFullName.set(fullClassName, nls.localize('apex_discovery_vfs_class_body_placeholder', fullClassName));
      }
    }
    return bodyByFullName;
  }

  private async restorePreviousResults(): Promise<void> {
    // Prevent concurrent restoration attempts
    if (this.isRestoringResults) {
      return;
    }

    this.isRestoringResults = true;
    try {
      if (!settings.retrieveRestorePreviousResults()) {
        return;
      }

      const entries = await getApexTestingRuntime().runPromise(
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          const resultDir = yield* getTestResultsFolder();
          return yield* api.services.FsService.readDirectory(resultDir);
        })
      );

      // Find all test-result JSON files. Filenames embed Salesforce test-run IDs, which are NOT
      // chronologically sortable, so we order by mtime below rather than by filename.
      const resultUris = entries.filter(
        uri =>
          uri.path.includes('test-result') && uri.path.endsWith('.json') && !uri.path.endsWith('-codecoverage.json')
      );

      if (resultUris.length === 0) {
        return;
      }

      // Filter to files within the age threshold and track which methods are pre-session
      const now = Date.now();
      const recentResults: { uri: URI; mtime: number }[] = [];
      const staleMethodIds = new Set<string>();
      const sessionMethodIds = new Set<string>();
      for (const uri of resultUris) {
        const stat = await vscode.workspace.fs.stat(uri);
        if (now - stat.mtime <= RESULT_MAX_AGE_MS) {
          recentResults.push({ uri, mtime: stat.mtime });
          const methodsInFile = await ApexTestController.getMethodIdsFromResultFile(uri);
          const targetSet = stat.mtime < this.sessionStartTime ? staleMethodIds : sessionMethodIds;
          for (const methodId of methodsInFile) {
            targetSet.add(methodId);
          }
        }
      }

      if (recentResults.length === 0) {
        return;
      }

      // Apply oldest-first (by mtime) so the most recent run's result wins for each method.
      const recentUris = sortUrisByMtimeAscending(recentResults);

      // Session results override stale (a method run this session is not stale)
      for (const methodId of sessionMethodIds) {
        staleMethodIds.delete(methodId);
      }

      // Apply oldest-first so most recent result for each method wins
      for (const uri of recentUris) {
        await this.updateTestResults(uri);
      }

      // Only mark pre-session methods as stale
      this.applyStaleTags(staleMethodIds);

      // Invalidate stale methods and classes where ALL methods are stale
      const affectedClasses = new Set<string>();
      for (const methodId of staleMethodIds) {
        const methodItem = this.methodItems.get(methodId);
        if (methodItem) {
          this.controller.invalidateTestResults(methodItem);
          affectedClasses.add(methodId.split('.')[0]);
        }
      }
      for (const className of affectedClasses) {
        const classPrefix = `${className}.`;
        const allMethodsStale = [...this.methodItems.entries()]
          .filter(([id]) => id.startsWith(classPrefix))
          .every(([id]) => staleMethodIds.has(id));
        if (allMethodsStale) {
          const classItem = this.classItems.get(className);
          if (classItem) {
            this.controller.invalidateTestResults(classItem);
          }
        }
      }

      // Get stat for most recent result (used for notification only)
      const lastStat = await vscode.workspace.fs.stat(recentUris.at(-1)!);

      const runDate = new Date(lastStat.mtime).toLocaleString();

      const disableAction = nls.localize('apex_test_results_restored_disable_action');
      void notificationService
        .showInformationMessage(
          nls.localize('apex_test_results_restored_message', String(recentUris.length), runDate),
          disableAction
        )
        .then(selection => {
          if (selection === disableAction) {
            void settings.disableRestorePreviousResults();
          }
        });
    } catch (error) {
      // Non-fatal: if restoration fails, the tree is still valid without results
      console.debug('Failed to restore previous test results:', error);
    } finally {
      this.isRestoringResults = false;
    }
  }

  private static async getMethodIdsFromResultFile(testResultUri: URI): Promise<Set<string>> {
    const methodIds = new Set<string>();
    try {
      const resultText = await getApexTestingRuntime().runPromise(
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          return yield* api.services.FsService.readFile(testResultUri);
        })
      );
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const resultContent = JSON.parse(resultText) as TestResult;
      for (const test of resultContent.tests ?? []) {
        const className = test.apexClass?.fullName;
        const methodName = test.methodName;
        if (className && methodName) {
          methodIds.add(`${className}.${methodName}`);
        }
      }
    } catch {
      // If we can't read the file, return empty set
    }
    return methodIds;
  }

  /**
   * Applies stale tags to methods whose results came from pre-session files.
   * Also propagates to parent class items and suite items that contain stale methods.
   * @param staleMethodIds Set of method IDs to mark as stale. If undefined, marks all methods.
   */
  private applyStaleTags(staleMethodIds?: Set<string>): void {
    for (const [methodId, methodItem] of this.methodItems) {
      if (staleMethodIds && !staleMethodIds.has(methodId)) {
        continue;
      }
      const existingTags = methodItem.tags ?? [];
      if (!existingTags.some(t => t.id === 'stale')) {
        methodItem.tags = [...existingTags, this.staleTag!];
      }
    }

    // Propagate stale tag to class items that have any stale methods
    for (const [className, classItem] of this.classItems) {
      const classPrefix = `${className}.`;
      const hasStaleMethod = [...this.methodItems.entries()].some(
        ([id, item]) => id.startsWith(classPrefix) && item.tags?.some(t => t.id === 'stale')
      );
      if (hasStaleMethod) {
        const existingTags = classItem.tags ?? [];
        if (!existingTags.some(t => t.id === 'stale')) {
          classItem.tags = [...existingTags, this.staleTag!];
        }
      }
    }

    // Propagate stale tag to suite items that contain any stale classes
    for (const [suiteName, suiteItem] of this.suiteItems) {
      const classNames = this.suiteToClasses.get(suiteName);
      if (classNames) {
        const hasStaleClass = [...classNames].some(cn => {
          const classItem = this.classItems.get(cn);
          return classItem?.tags?.some(t => t.id === 'stale');
        });
        if (hasStaleClass) {
          const existingTags = suiteItem.tags ?? [];
          if (!existingTags.some(t => t.id === 'stale')) {
            suiteItem.tags = [...existingTags, this.staleTag!];
          }
        }
      }
    }
  }

  /**
   * Clears stale tags from specific test items that were just run.
   * @param testsToRun The tests that were executed in the run
   */
  private clearStaleTagsForTests(testsToRun: vscode.TestItem[]): void {
    // Build a set of method map keys that were just run (keys don't have the method: prefix)
    const runMethodIds = new Set<string>();
    for (const test of testsToRun) {
      if (isMethod(test.id)) {
        runMethodIds.add(test.id.replace(TEST_ID_PREFIXES.METHOD, ''));
      } else if (isClass(test.id)) {
        const className = extractClassName(test.id);
        if (className) {
          const classPrefix = `${className}.`;
          for (const methodId of this.methodItems.keys()) {
            if (methodId.startsWith(classPrefix)) {
              runMethodIds.add(methodId);
            }
          }
        }
      } else if (isSuite(test.id)) {
        // Add all methods from all classes in the suite
        const suiteName = extractSuiteName(test.id);
        const classNames = suiteName ? this.suiteToClasses.get(suiteName) : undefined;
        if (classNames) {
          for (const className of classNames) {
            const classPrefix = `${className}.`;
            for (const methodId of this.methodItems.keys()) {
              if (methodId.startsWith(classPrefix)) {
                runMethodIds.add(methodId);
              }
            }
          }
        }
      }
    }

    // Clear stale tags from methods that were run
    const affectedClasses = new Set<string>();
    for (const methodId of runMethodIds) {
      const methodItem = this.methodItems.get(methodId);
      if (methodItem) {
        const nextTags = (methodItem.tags ?? []).filter(t => t.id !== 'stale');
        methodItem.tags = nextTags;
        affectedClasses.add(methodId.split('.')[0]);
      }
    }

    // Remove stale tag from parent class items if no methods remain stale
    for (const className of affectedClasses) {
      const classItem = this.classItems.get(className);
      if (classItem) {
        const classPrefix = `${className}.`;
        const hasStaleMethod = [...this.methodItems.entries()].some(
          ([id, item]) => id.startsWith(classPrefix) && item.tags?.some(t => t.id === 'stale')
        );
        if (!hasStaleMethod) {
          const nextTags = (classItem.tags ?? []).filter(t => t.id !== 'stale');
          classItem.tags = nextTags;
        }
      }
    }

    // Remove stale tag from suite items if no member classes remain stale
    for (const [suiteName, suiteItem] of this.suiteItems) {
      const classNames = this.suiteToClasses.get(suiteName);
      if (classNames) {
        const hasStaleClass = [...classNames].some(cn => {
          const classItem = this.classItems.get(cn);
          return classItem?.tags?.some(t => t.id === 'stale');
        });
        if (!hasStaleClass) {
          const nextTags = (suiteItem.tags ?? []).filter(t => t.id !== 'stale');
          suiteItem.tags = nextTags;
        }
      }
    }
  }

  /**
   * Incrementally updates the test tree based on deployed metadata changes.
   * Unlike discoverTests/refresh, this preserves existing test results for unchanged classes.
   */
  public async incrementalUpdate(changes: Map<string, string>, includesSuiteChange: boolean): Promise<void> {
    try {
      await this.ensureInitialized();

      // Handle deletions immediately (no API call needed)
      for (const [fullName, changeType] of changes) {
        if (changeType === 'deleted') {
          this.removeClassFromTree(fullName);
        }
      }

      // If any created/changed entries remain, call discovery API and apply diff
      const nonDeleteChanges = new Map([...changes].filter(([_, changeType]) => changeType !== 'deleted'));

      if (nonDeleteChanges.size > 0) {
        const discoveryResult = await getApexTestingRuntime().runPromise(discoverTests());
        await this.persistDiscoveredClasses(discoveryResult.classes);
        await this.applyIncrementalDiff(discoveryResult.classes, nonDeleteChanges);
      }

      if (includesSuiteChange) {
        this.clearAllSuiteChildren();
      }
    } catch {
      // Non-fatal: incremental update failure doesn't affect existing tree state
    }
  }

  private removeClassFromTree(fullClassName: string): void {
    const classItem = this.classItems.get(fullClassName);
    if (!classItem) {
      return;
    }

    // Remove method items
    classItem.children.forEach(methodItem => {
      this.methodItems.delete(methodItem.id);
    });

    // Remove class from parent
    const parentItem = this.classToParentItem.get(fullClassName);
    if (parentItem) {
      parentItem.children.delete(classItem.id);
      // Clean up empty parent nodes
      if (parentItem.children.size === 0) {
        this.removeEmptyAncestors(parentItem);
      }
    }

    this.classItems.delete(fullClassName);
    this.classToParentItem.delete(fullClassName);
  }

  private removeEmptyAncestors(item: vscode.TestItem): void {
    // Walk up the tree removing empty nodes (package → namespace)
    // TestItems don't have a parent reference, so we search controller.items
    this.controller.items.forEach(namespaceItem => {
      namespaceItem.children.forEach(packageItem => {
        if (packageItem.id === item.id && packageItem.children.size === 0) {
          namespaceItem.children.delete(packageItem.id);
        }
      });
      if (namespaceItem.children.size === 0) {
        this.controller.items.delete(namespaceItem.id);
      }
    });
  }

  private async applyIncrementalDiff(
    discoveredClasses: ToolingTestClass[],
    changes: Map<string, string>
  ): Promise<void> {
    const apexClasses = discoveredClasses.filter(cls => cls.testMethods?.length > 0 && !isFlowTest(cls));
    const discoveryMap = new Map<string, ToolingTestClass>();
    for (const cls of apexClasses) {
      discoveryMap.set(getFullClassName(cls), cls);
    }

    const classNameToUri = await buildClassToUriIndex(apexClasses.map(cls => cls.name));
    const { orgId } = await getDefaultOrgInfo();
    // No default org → no org-scoped tree to diff against.
    if (!orgId) return;

    for (const [fullName, changeType] of changes) {
      const discoveredClass = discoveryMap.get(fullName);
      const existingClassItem = this.classItems.get(fullName);

      if (changeType === 'created' || (!existingClassItem && discoveredClass)) {
        // New class: add to tree
        if (discoveredClass) {
          await this.addClassToTree(discoveredClass, classNameToUri, orgId);
        }
      } else if (changeType === 'changed' && existingClassItem && discoveredClass) {
        // Always apply stale tags for filtering (remove active tags)
        existingClassItem.children.forEach(methodItem => {
          const existingTags = methodItem.tags ?? [];
          if (!existingTags.some(t => t.id === 'stale')) {
            methodItem.tags = [...existingTags, this.staleTag!];
          }
        });

        // Invalidate existing results before diffing (so new methods aren't marked stale)
        this.controller.invalidateTestResults(existingClassItem);
        await this.diffClassMethods(fullName, existingClassItem, discoveredClass, classNameToUri);
      } else if (existingClassItem && !discoveredClass) {
        // Class no longer in discovery (e.g. @isTest removed) — remove it
        this.removeClassFromTree(fullName);
      }
    }
  }

  private async addClassToTree(cls: ToolingTestClass, classNameToUri: Map<string, URI>, orgKey: string): Promise<void> {
    const [connection, orgInfo] = await Promise.all([this.getConnection(), getDefaultOrgInfo()]);
    const classIds = cls.id ? [cls.id] : [];
    const classIdToPackage = await resolvePackage2Members(
      connection,
      classIds,
      buildClassIdToNamespace([cls]),
      orgInfo
    );

    const structure = buildNamespacePackageStructure([cls], classIdToPackage);
    const createClassAndMethods = createClassAndMethodsFactory({
      controller: this.controller,
      classItems: this.classItems,
      methodItems: this.methodItems,
      classNameToUri,
      orgKey,
      orgOnlyTag: this.orgOnlyTag,
      inWorkspaceTag: this.inWorkspaceTag
    });

    for (const [nsKey, pkMap] of structure) {
      for (const [_pkgKey, classEntriesList] of pkMap) {
        for (const { fullClassName: fcn, entries } of classEntriesList) {
          // Find or create namespace node
          let namespaceItem: vscode.TestItem | undefined;
          this.controller.items.forEach(item => {
            if (item.id === createNamespaceId(nsKey)) {
              namespaceItem = item;
            }
          });
          if (!namespaceItem) {
            namespaceItem = this.controller.createTestItem(
              createNamespaceId(nsKey),
              getNamespaceDisplayLabel(nsKey),
              undefined
            );
            this.controller.items.add(namespaceItem);
          }

          // Find or create package node
          const classEntry = classEntriesList[0];
          const info = classEntry.entries[0].id ? classIdToPackage.get(classEntry.entries[0].id) : undefined;
          const packageLabel = info?.packageName ?? _pkgKey;
          const pkgNodeId = `${nsKey}/${_pkgKey}`;
          let packageItem: vscode.TestItem | undefined;
          namespaceItem.children.forEach(item => {
            if (item.id === pkgNodeId || item.label === packageLabel) {
              packageItem = item;
            }
          });
          if (!packageItem) {
            packageItem = this.controller.createTestItem(pkgNodeId, packageLabel, undefined);
            namespaceItem.children.add(packageItem);
          }

          const classItem = createClassAndMethods(fcn, entries);
          packageItem.children.add(classItem);
          this.classToParentItem.set(fcn, packageItem);
        }
      }
    }
  }

  private async diffClassMethods(
    fullClassName: string,
    classItem: vscode.TestItem,
    discoveredClass: ToolingTestClass,
    classNameToUri: Map<string, URI>
  ): Promise<void> {
    // Tooling API is authoritative for which methods are test methods (@isTest)
    const discoveredMethodNames = new Set((discoveredClass.testMethods ?? []).map(m => m.name));

    const localUri = classNameToUri.get(discoveredClass.name);
    const uri = localUri ?? classItem.uri;
    const isOrgOnly = !localUri;

    // Use LSP for positions (accurate after deploy), fall back to Tooling API positions
    const methodPositions = new Map<string, { line: number; column: number }>();
    if (localUri) {
      const symbolLocations = await getMethodLocationsFromSymbols(localUri, [...discoveredMethodNames]);
      if (symbolLocations) {
        for (const [name, location] of symbolLocations) {
          methodPositions.set(name, { line: location.range.start.line, column: location.range.start.character });
        }
      }
    }
    for (const method of discoveredClass.testMethods ?? []) {
      if (!methodPositions.has(method.name)) {
        methodPositions.set(method.name, {
          line: Math.max(0, (method.line ?? 1) - 1),
          column: Math.max(0, (method.column ?? 1) - 1)
        });
      }
    }

    const existingMethodsByName = new Map<string, vscode.TestItem>();
    classItem.children.forEach(child => {
      if (isMethod(child.id)) {
        existingMethodsByName.set(child.label, child);
      }
    });

    // Remove methods no longer in discovery
    for (const [methodName, methodItem] of existingMethodsByName) {
      if (!discoveredMethodNames.has(methodName)) {
        this.methodItems.delete(methodItem.id);
        existingMethodsByName.delete(methodName);
      }
    }

    // Sort method names by resolved position
    const sortedMethodNames = [...discoveredMethodNames].toSorted((a, b) => {
      const posA = methodPositions.get(a);
      const posB = methodPositions.get(b);
      return (posA?.line ?? 0) - (posB?.line ?? 0);
    });

    // Build ordered children list
    const orderedChildren: vscode.TestItem[] = [];
    for (const methodName of sortedMethodNames) {
      const existing = existingMethodsByName.get(methodName);
      if (existing) {
        const pos = methodPositions.get(methodName);
        if (pos) {
          const position = new vscode.Position(pos.line, pos.column);
          existing.range = new vscode.Range(position, position);
        }
        orderedChildren.push(existing);
      } else {
        const methodId = createMethodId(fullClassName, methodName);
        const pos = methodPositions.get(methodName) ?? { line: 0, column: 0 };
        const position = new vscode.Position(pos.line, pos.column);
        const range = new vscode.Range(position, position);
        const methodItem = this.controller.createTestItem(methodId, methodName, uri);
        methodItem.range = range;
        if (isOrgOnly && this.orgOnlyTag) {
          methodItem.tags = [this.orgOnlyTag];
        } else if (this.inWorkspaceTag) {
          methodItem.tags = [this.inWorkspaceTag];
        }
        this.methodItems.set(methodId, methodItem);
        orderedChildren.push(methodItem);
      }
    }

    // Replace all children in source order
    classItem.children.replace(orderedChildren);

    // Update class tags if workspace presence changed (URI is readonly on TestItem)
    if (localUri && this.inWorkspaceTag && !classItem.tags?.includes(this.inWorkspaceTag)) {
      classItem.tags = [this.inWorkspaceTag];
    }
  }

  public async onResultFileCreate(apexTestDir: URI, testResultUri: URI): Promise<void> {
    const testRunId = await readTestRunIdFile(apexTestDir);

    const expectedResultUri = Utils.joinPath(
      apexTestDir,
      testRunId ? `test-result-${testRunId}.json` : TEST_RESULT_JSON_FILE
    );

    if (testResultUri.toString() === expectedResultUri.toString()) {
      if (this.lastProcessedResultFile?.toString() === testResultUri.toString()) {
        return;
      }
      this.lastProcessedResultFile = testResultUri;
      await this.updateTestResults(testResultUri);
    }
  }

  private clearTestItems(): void {
    void vscode.commands.executeCommand('testing.clearTestResults');
    this.controller.items.replace([]);
    this.suiteItems.clear();
    this.classItems.clear();
    this.methodItems.clear();
    this.classToParentItem.clear();
    this.suiteParentItem = undefined;
    this.suiteToClasses.clear();
  }

  private invalidateConnection(): void {
    this.connection = undefined;
    this.testService = undefined;
    getOrgApexClassProvider().clearAllCache();
  }

  /**
   * Populate test items from org test classes (Tooling API).
   * Groups by namespace then package (2GP / 1GP / unpackaged). Shows all test classes in the org.
   */
  private async populateTestItemsFromOrg(classes: ToolingTestClass[]): Promise<void> {
    const apexClasses = classes.filter(cls => cls.testMethods?.length > 0 && !isFlowTest(cls));
    if (apexClasses.length === 0) {
      return;
    }

    const classNameToUri = await buildClassToUriIndex(apexClasses.map(cls => cls.name));

    const classIds = apexClasses
      .map(cls => cls.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const [connection, orgInfo] = await Promise.all([this.getConnection(), getDefaultOrgInfo()]);
    // No default org → no org-scoped tree to build.
    if (!orgInfo.orgId) return;
    const orgKey = orgInfo.orgId;
    const classIdToPackage = await resolvePackage2Members(
      connection,
      classIds,
      buildClassIdToNamespace(apexClasses),
      orgInfo
    );

    const structure = buildNamespacePackageStructure(apexClasses, classIdToPackage);
    const createClassAndMethods = createClassAndMethodsFactory({
      controller: this.controller,
      classItems: this.classItems,
      methodItems: this.methodItems,
      classNameToUri,
      orgKey,
      orgOnlyTag: this.orgOnlyTag,
      inWorkspaceTag: this.inWorkspaceTag
    });

    const BATCH_SIZE = 50;
    let processed = 0;

    for (const nsKey of sortNamespaceKeys(structure)) {
      const pkMap = structure.get(nsKey);
      if (!pkMap) {
        continue;
      }

      const namespaceItem = this.controller.createTestItem(
        createNamespaceId(nsKey),
        getNamespaceDisplayLabel(nsKey),
        undefined
      );

      for (const pkgKey of getPackageKeysOrdered(nsKey, [...pkMap.keys()])) {
        const classEntriesList = pkMap.get(pkgKey);
        if (!isNonEmptyClassEntriesList(classEntriesList)) {
          continue;
        }

        const { packageLabel, packageId } = getPackageLabelAndId(nsKey, pkgKey, classEntriesList, classIdToPackage);
        const packageItem = this.controller.createTestItem(packageId, packageLabel, undefined);

        for (const { fullClassName, entries } of classEntriesList) {
          try {
            packageItem.children.add(createClassAndMethods(fullClassName, entries));
            this.classToParentItem.set(fullClassName, packageItem);
            processed++;
            if (processed % BATCH_SIZE === 0) {
              await new Promise<void>(resolve => {
                if (typeof setImmediate !== 'undefined') {
                  setImmediate(() => resolve());
                } else {
                  void Promise.resolve().then(() => resolve());
                }
              });
            }
          } catch (error) {
            console.error(`Error processing class ${fullClassName}:`, error);
          }
        }
        namespaceItem.children.add(packageItem);
      }
      this.controller.items.add(namespaceItem);
    }
  }

  private async populateSuiteItems(): Promise<void> {
    try {
      // Ensure connection and testService are initialized
      await this.ensureInitialized();

      let suites: { id: string; TestSuiteName: string }[] = [];
      try {
        suites = await this.getTestService().retrieveAllSuites();
      } catch (error) {
        console.error('Error retrieving suites:', error);
        return;
      }

      if (suites.length === 0) {
        return;
      }

      // Create parent "Apex Test Suites" node
      const suiteParentId = 'apex-test-suites-parent';
      this.suiteParentItem = this.controller.createTestItem(
        suiteParentId,
        nls.localize('apex_test_suites_parent_text'),
        undefined
      );
      if (this.suiteTag) {
        this.suiteParentItem.tags = [this.suiteTag];
      }

      // Add all suites as children of the parent
      for (const suite of suites) {
        const suiteId = createSuiteId(suite.TestSuiteName);
        const suiteItem = this.controller.createTestItem(suiteId, suite.TestSuiteName, undefined);
        suiteItem.canResolveChildren = true;
        if (this.suiteTag) {
          suiteItem.tags = [this.suiteTag];
        }
        this.suiteItems.set(suite.TestSuiteName, suiteItem);
        this.suiteParentItem.children.add(suiteItem);
      }

      // Add the parent item first so it appears at the top
      this.controller.items.add(this.suiteParentItem);
    } catch (error) {
      const friendlyMessage = toUserFriendlyApexTestError(error);
      throw new Error(nls.localize('apex_test_populate_suite_items_failed_message', friendlyMessage));
    }
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
          })()
        );
        await closeEditorTabByUri(uri);
      }

      try {
        await this.refresh();
      } catch (error) {
        console.debug('Failed to refresh Apex tests after retrieve:', error);
      }

      notificationService.showSuccessfulExecution(executionName);
    } catch {
      notificationService.showFailedExecution(executionName);
    }
  }

  private async resolveSuiteChildren(suiteItem: vscode.TestItem): Promise<void> {
    // If children are already populated, skip
    if (suiteItem.children.size > 0) {
      return;
    }

    const suiteName = extractSuiteName(suiteItem.id);
    if (!suiteName) {
      return;
    }

    try {
      // Ensure connection and testService are initialized
      await this.ensureInitialized();

      // Get test suite membership records (contains ApexClassId)
      const classesInSuite = await this.getTestService().getTestsInSuite(suiteName);

      if (classesInSuite.length === 0) {
        console.debug(`No test classes found for suite: ${suiteName}`);
        return;
      }

      // Extract class IDs and query for class names and namespace (for full name lookup)
      const classIds = classesInSuite.map(record => record.ApexClassId);
      const classNamesQuery = `SELECT Id, Name, NamespacePrefix FROM ApexClass WHERE Id IN (${classIds.map(id => `'${id.replaceAll("'", "''")}'`).join(',')})`;
      const queryResult = await this.getConnection().tooling.query<{
        Name: string;
        NamespacePrefix: string | null;
      }>(classNamesQuery);

      const classNames = queryResult.records.map((record: { Name: string; NamespacePrefix?: string | null }) =>
        record.NamespacePrefix?.trim() ? `${record.NamespacePrefix}.${record.Name}` : record.Name
      );

      // Store the mapping of suite to classes (full class names for lookup)
      this.suiteToClasses.set(suiteName, new Set(classNames));

      // Add class items as children of the suite (placeholders; actual class items live under namespace/package)
      for (const className of classNames) {
        const existingClassItem = this.classItems.get(className);
        const classItem = this.controller.createTestItem(
          createSuiteClassId(suiteName, className),
          className,
          existingClassItem?.uri
        );
        suiteItem.children.add(classItem);
      }
    } catch (error) {
      const friendlyMessage = toUserFriendlyApexTestError(error);
      throw new Error(nls.localize('apex_test_resolve_suite_children_failed_message', suiteName, friendlyMessage));
    }
  }

  private async runTests(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
    isDebug: boolean,
    runScope: ApexTestRunScope
  ): Promise<void> {
    const run = this.controller.createTestRun(request);
    let testsToRun = gatherTests(request, this.controller.items, this.suiteItems);

    await cacheSingleSelection(request, isDebug);

    // Implicit full run: no explicit selection. Restrict to in-workspace tests for the default Run/Debug profiles.
    // When the user (or explorer filter) supplies request.include, run exactly that set—e.g. filtered-visible tests.
    const isImplicitFullRun = !request.include?.length;
    if (runScope === 'workspace-first' && isImplicitFullRun && this.inWorkspaceTag) {
      testsToRun = testsToRun.filter(test => test.tags?.includes(this.inWorkspaceTag!));
    }

    // Stale profiles: expand all items to methods, keep only those with stale + location tag
    if (runScope === 'stale-workspace' || runScope === 'stale-org') {
      const requiredLocationTag = runScope === 'stale-workspace' ? 'in-workspace' : 'org-only';
      const staleMethods: vscode.TestItem[] = [];
      const isStaleAndMatchesLocation = (item: vscode.TestItem): boolean =>
        !!(item.tags?.some(t => t.id === 'stale') && item.tags?.some(t => t.id === requiredLocationTag));

      for (const test of testsToRun) {
        if (isMethod(test.id)) {
          if (isStaleAndMatchesLocation(test)) {
            staleMethods.push(test);
          }
        } else {
          // Parent item (class, suite, namespace) — find stale methods in methodItems
          const classNames: string[] = [];
          if (isClass(test.id)) {
            const cn = extractClassName(test.id);
            if (cn) {
              classNames.push(cn);
            }
          } else if (isSuite(test.id)) {
            const suiteName = extractSuiteName(test.id);
            const suiteClasses = suiteName ? this.suiteToClasses.get(suiteName) : undefined;
            if (suiteClasses) {
              classNames.push(...suiteClasses);
            }
          }

          for (const className of classNames) {
            const classPrefix = `${className}.`;
            for (const [methodId, methodItem] of this.methodItems) {
              if (methodId.startsWith(classPrefix) && isStaleAndMatchesLocation(methodItem)) {
                staleMethods.push(methodItem);
              }
            }
          }
        }
      }
      testsToRun = staleMethods;
    }

    // Resolve any suite in testsToRun so we have class data (for empty-suite check and expansion)
    for (const test of testsToRun) {
      if (isSuite(test.id)) {
        const suiteName = extractSuiteName(test.id);
        if (suiteName && test.children.size === 0) {
          await this.resolveSuiteChildren(test);
        }
      }
    }

    // Expand suites to their classes/methods when running all tests
    // This ensures we use method names instead of suite parameters, which allows running multiple suites
    if (!request.include || request.include.length === 0) {
      const expandedTests: vscode.TestItem[] = [];
      for (const test of testsToRun) {
        if (isSuite(test.id)) {
          // Expand suite to its classes - resolve suite if needed, then get class names
          const suiteName = extractSuiteName(test.id);
          if (suiteName) {
            // Resolve suite children if not already resolved
            if (test.children.size === 0) {
              await this.resolveSuiteChildren(test);
            }
            const classNames = this.suiteToClasses.get(suiteName);
            if (classNames && classNames.size > 0) {
              // Find the actual class items and add their methods
              for (const className of classNames) {
                const classItem = this.classItems.get(className);
                if (classItem) {
                  // Add all methods from this class
                  classItem.children.forEach(methodItem => {
                    expandedTests.push(methodItem);
                  });
                }
              }
            } else {
              // Suite not resolved yet or has no classes - keep the suite item (will be handled by payload builder)
              expandedTests.push(test);
            }
          } else {
            expandedTests.push(test);
          }
        } else {
          // Not a suite - keep as-is
          expandedTests.push(test);
        }
      }
      testsToRun = expandedTests;
    }

    // Suite expansion pulls methods from live class items and can reintroduce tests hidden by the explorer filter.
    testsToRun = filterTestItemsByRequestExclude(testsToRun, request.exclude);

    // Check for empty test suites and show clear error
    const emptySuiteItems = testsToRun.filter(
      test => isSuite(test.id) && (this.suiteToClasses.get(extractSuiteName(test.id) ?? '')?.size ?? 0) === 0
    );
    if (emptySuiteItems.length > 0) {
      const emptySuiteNames = emptySuiteItems.map(test => extractSuiteName(test.id)).filter((n): n is string => !!n);
      for (const suiteItem of emptySuiteItems) {
        run.errored(suiteItem, new vscode.TestMessage(nls.localize('apex_test_suite_empty_message')));
      }
      void notificationService.showErrorMessage(
        nls.localize('apex_test_suite_empty_message_notification', emptySuiteNames.join(', '))
      );
      testsToRun = testsToRun.filter(test => !emptySuiteItems.includes(test));
    }

    if (testsToRun.length === 0) {
      run.end();
      return;
    }

    try {
      // Mark tests as running
      for (const test of testsToRun) {
        run.started(test);
      }

      if (isDebug) {
        // For debug, delegate to existing debug commands
        await this.debugTests(testsToRun, run);
      } else {
        // For run, execute tests using existing Apex test execution
        const testNames = testsToRun.map(test => getTestName(test));
        const tmpFolder = await getTempFolder();
        const codeCoverage = settings.retrieveTestCodeCoverage();
        // RunAllTestsInOrg only for the explicit "all org" profile on an implicit full run
        const runAllTestsInOrg =
          runScope === 'all-org' && isImplicitFullRun && (!request.exclude || request.exclude.length === 0);
        await this.executeTests(testNames, tmpFolder, codeCoverage, token, run, testsToRun, runAllTestsInOrg);
      }

      const testCount = testsToRun.length;
      getApexTestingRuntime().runFork(
        Effect.annotateCurrentSpan({
          trigger: 'testController',
          isDebug: String(isDebug),
          testsRan: testCount
        }).pipe(Effect.withSpan('apexTestRun'))
      );
    } catch (error) {
      const friendlyMessage = toUserFriendlyApexTestError(error);
      for (const test of testsToRun) {
        run.errored(test, new vscode.TestMessage(friendlyMessage));
      }
    } finally {
      run.end();
    }
  }

  private async debugTests(testsToRun: vscode.TestItem[], run: vscode.TestRun): Promise<void> {
    // Check for org-only tests - debugging is not supported for these
    let testsToDebug = testsToRun;
    if (this.orgOnlyTag) {
      const orgOnlyTests = testsToRun.filter(test => test.tags?.includes(this.orgOnlyTag!));
      if (orgOnlyTests.length > 0) {
        const errorMessage = nls.localize('apex_test_debug_org_only_warning_message');
        for (const test of orgOnlyTests) {
          run.errored(test, new vscode.TestMessage(errorMessage));
        }
        // Show failure notification
        void notificationService.showErrorMessage(errorMessage);
        // Filter out org-only tests
        testsToDebug = testsToRun.filter(test => !test.tags?.includes(this.orgOnlyTag!));
      }
    }

    if (testsToDebug.length === 0) {
      return;
    }

    const classIdsToDebug = new Set<string>();
    const methodsToDebug = new Map<string, Set<string>>();

    for (const test of testsToDebug) {
      try {
        if (isMethod(test.id)) {
          // Extract class name from method ID (format: ClassName.MethodName)
          const testName = getTestName(test);
          const className = extractClassName(test.id);
          if (className) {
            const existingMethods = methodsToDebug.get(className) ?? new Set<string>();
            existingMethods.add(testName);
            methodsToDebug.set(className, existingMethods);
          } else {
            // Fallback: debug single method if we can't extract class name
            await vscode.commands.executeCommand('sf.test.view.debugSingleTest', { name: testName });
          }
        } else if (isClass(test.id)) {
          // Debug class (all methods in class)
          const className = getTestName(test);
          classIdsToDebug.add(className);
        } else if (isSuite(test.id)) {
          // Suites cannot be debugged - only individual classes or methods can be debugged
          run.errored(test, new vscode.TestMessage(nls.localize('apex_test_suite_debug_not_supported_message')));
        }
      } catch (error) {
        const friendlyMessage = toUserFriendlyApexTestError(error);
        run.errored(test, new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', friendlyMessage)));
      }
    }

    for (const className of classIdsToDebug) {
      try {
        await vscode.commands.executeCommand('sf.test.view.debugTests', { name: className });
      } catch (error) {
        const friendlyMessage = toUserFriendlyApexTestError(error);
        for (const test of testsToDebug) {
          if (
            (isClass(test.id) && getTestName(test) === className) ||
            (isMethod(test.id) && extractClassName(test.id) === className)
          ) {
            run.errored(test, new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', friendlyMessage)));
          }
        }
      }
    }

    for (const [className, methods] of methodsToDebug) {
      // If class-level debug is explicitly selected, skip method-level debug for the same class.
      if (classIdsToDebug.has(className)) {
        continue;
      }

      for (const methodName of methods) {
        try {
          await vscode.commands.executeCommand('sf.test.view.debugSingleTest', { name: methodName });
        } catch (error) {
          const friendlyMessage = toUserFriendlyApexTestError(error);
          for (const test of testsToDebug) {
            if (isMethod(test.id) && extractClassName(test.id) === className && getTestName(test) === methodName) {
              run.errored(
                test,
                new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', friendlyMessage))
              );
            }
          }
        }
      }
    }
  }

  private async executeTests(
    testNames: string[],
    outputDir: URI,
    codeCoverage: boolean,
    token: vscode.CancellationToken,
    run: vscode.TestRun,
    testsToRun: vscode.TestItem[],
    runAllTestsInOrg = false
  ): Promise<void> {
    // Ensure connection and testService are initialized
    await this.ensureInitialized();

    const testService = this.getTestService();
    const { payload, hasSuite, hasClass } = runAllTestsInOrg
      ? {
          payload: {
            testLevel: TestLevel.RunAllTestsInOrg,
            skipCodeCoverage: !codeCoverage
          },
          hasSuite: false,
          hasClass: false
        }
      : await buildTestPayload(testService, testsToRun, testNames, codeCoverage);

    if (!payload) {
      throw new Error(nls.localize('apex_test_payload_build_failed_message'));
    }

    // TODO: fix in apex-node W-18453221
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = (await testService.runTestAsynchronous(
      payload,
      codeCoverage,
      false,
      {
        report: value => {
          // Add progress messages to test run output
          if (value.type === 'StreamingClientProgress' || value.type === 'FormatTestResultProgress') {
            run.appendOutput(`${value.message}\n`);
          }
        }
      },
      token
    )) as TestResult;

    if (token.isCancellationRequested) {
      return;
    }

    // Write JSON test result file and claim it as processed so the testResultsFileWatcher's
    // onResultFileCreate -> updateTestResults path treats it as already-processed and skips
    // creating a second, disconnected TestRun for these same results. Without this, that
    // second run is constructed with a fresh vscode.TestRunRequest(), which detaches it from
    // the shared Run-All request. As a consequence, when "Test: Run All Tests" kicks off both
    // Apex and LWC controllers and Apex finishes second, the shared (LWC + Apex) group gets
    // evicted to "older results" and only the fresh Apex-only run remains as "current".
    await writeTestResultJsonFile(result, outputDir, codeCoverage);
    const writtenResultFilename = result.summary?.testRunId
      ? `test-result-${result.summary.testRunId}.json`
      : TEST_RESULT_JSON_FILE;
    this.lastProcessedResultFile = Utils.joinPath(outputDir, writtenResultFilename);

    // Generate and open test report (forked; continue even if report generation fails)
    const outputFormat = settings.retrieveOutputFormat();
    const sortOrder = settings.retrieveTestSortOrder();
    getApexTestingRuntime().runFork(
      writeAndOpenTestReport(result, outputDir, outputFormat, codeCoverage, sortOrder).pipe(
        Effect.tap(() => Effect.annotateCurrentSpan({ trigger: 'testExplorer' })),
        Effect.withSpan('apexTestReportGenerated'),
        Effect.catchAllCause(cause => Effect.logError('Failed to generate test report', cause))
      )
    );

    // Clear stale indicators and apply active tags BEFORE updating results.
    // VS Code snapshots item.description when run.passed() is called.
    this.clearStaleTagsForTests(testsToRun);

    // Update test results in Test Explorer (will snapshot the cleared description)
    updateTestRunResults({
      result,
      run,
      testsToRun,
      methodItems: this.methodItems,
      classItems: this.classItems,
      codeCoverage
    });

    // Show success notification if the command ran successfully (tests executed)
    // The test results panel will show which tests passed/failed
    const totalCount = result.summary.testsRan ?? 0;

    // Determine execution name based on what was run (hasSuite and hasClass set above)
    let executionName: string;
    if (hasSuite) {
      executionName = nls.localize('apex_test_suite_run_text');
    } else if (hasClass) {
      executionName = nls.localize('apex_test_class_run_text');
    } else {
      executionName = nls.localize('apex_test_run_text');
    }
    // Show success notification if tests ran successfully (regardless of test results)
    if (totalCount > 0) {
      notificationService.showSuccessfulExecution(executionName);
    }
  }

  private async updateTestResults(testResultUri: URI): Promise<void> {
    const resultText = await getApexTestingRuntime().runPromise(
      Effect.gen(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        return yield* api.services.FsService.readFile(testResultUri);
      })
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const resultContent = JSON.parse(resultText) as TestResult;

    const run = this.controller.createTestRun(new vscode.TestRunRequest());
    try {
      const codeCoverage = settings.retrieveTestCodeCoverage();
      const concise = settings.retrieveTestRunConcise();
      updateTestRunResults({
        result: resultContent,
        run,
        testsToRun: [],
        methodItems: this.methodItems,
        classItems: this.classItems,
        codeCoverage,
        concise
      });
    } finally {
      run.end();
    }
  }

  public dispose(): void {
    this.controller.dispose();
  }
}

// Module-level utility functions extracted from ApexTestController

// Cache single class/method selections so Re-Run Last Class/Method surfaces (esp. web, no code lenses).
// Detect from the RAW request.include before suite resolution/expansion. Run-profile only (not Debug).
// Suite-class ids (suite-class:Suite:Class) are a single class hit; getTestName yields the bare class name.
// Bare suite/namespace/package/multi-select/implicit-full leave the cache untouched.
// Cache is set before run viability is known (matches code-lens order): a single class/method that resolves
// to zero runnable tests still populates Re-Run Last and flips sf:has_cached_test_*. Acceptable—single targets
// are normally non-empty, and re-running a no-op selection is harmless.
// Best-effort: failures are logged (tapError) then swallowed (ignore) so they never fail the run.
const cacheSingleSelection = async (request: vscode.TestRunRequest, isDebug: boolean): Promise<void> => {
  const single = request.include?.length === 1 ? request.include[0] : undefined;
  if (isDebug || !single) {
    return;
  }
  await Match.value(single.id).pipe(
    Match.when(
      id => isClass(id) || isSuiteClass(id),
      () => ApexTestRunCacheService.setCachedClassTestParam(getTestName(single))
    ),
    Match.when(isMethod, () => ApexTestRunCacheService.setCachedMethodTestParam(getTestName(single))),
    Match.orElse(() => Effect.void),
    Effect.tapError(error => Effect.logWarning('apex test re-run cache set failed', { error })),
    Effect.ignore,
    getApexTestingRuntime().runPromise
  );
};

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

const closeEditorTabByUri = async (uri: URI): Promise<void> => {
  const tabGroupsApi = vscode.window.tabGroups;
  if (!tabGroupsApi) {
    return;
  }
  const tabsToClose: vscode.Tab[] = [];
  for (const group of tabGroupsApi.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === uri.toString()) {
        tabsToClose.push(tab);
      }
    }
  }
  if (tabsToClose.length > 0) {
    await tabGroupsApi.close(tabsToClose, true);
  }
};

const getTempFolder = async (): Promise<URI> => {
  try {
    return await getApexTestingRuntime().runPromise(getTestResultsFolder());
  } catch {
    throw new Error(nls.localize('cannot_determine_workspace'));
  }
};

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

/**
 * Returns the URIs sorted oldest-first by mtime. Restoration applies results oldest-first so the
 * most recent run wins per method. See {@link sortByMtimeAscending} for why mtime, not filename.
 */
export const sortUrisByMtimeAscending = (items: readonly { uri: URI; mtime: number }[]): URI[] =>
  sortByMtimeAscending(items).map(item => item.uri);
