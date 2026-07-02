/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ToolingTestClass } from '../testDiscovery/schemas';
import { TestResult, TestService } from '@salesforce/apex-node';
import type { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { RetrieveResult } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Equal from 'effect/Equal';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { getConnection, getDefaultOrgInfo } from '../coreExtensionUtils';
import { ApexTestDiscoveryService } from '../discoveryVfs/apexTestDiscoveryService';
import { APEX_TESTING_SCHEME, isForeignOrgClassUri } from '../discoveryVfs/apexTestingDiscoveryFs';
import { nls } from '../messages';
import { getApexTestingRuntime } from '../services/extensionProvider';
import { resolvePackage2Members } from '../testDiscovery/packageResolution';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { toUserFriendlyApexTestError } from '../utils/apexTestErrorMapper';
import { notificationService } from '../utils/notificationHelpers';
import { getOrgApexClassProvider } from '../utils/orgApexClassProvider';
import { getTestResultsFolder } from '../utils/pathHelpers';
import {
  createMethodId,
  createNamespaceId,
  createSuiteClassId,
  extractSuiteName,
  isClass,
  isMethod,
  isSuite
} from '../utils/testItemUtils';
import { buildClassToUriIndex, getMethodLocationsFromSymbols } from '../utils/testUtils';
import { getFullClassName, isFlowTest } from '../utils/toolingTestClassHelpers';
import { ApexTestExecutionService, type ApexTestRunScope, type ExecutionContext } from './apexTestExecutionService';
import { ApexTestTreeService, type DiscoveryContext } from './apexTestTreeService';
import {
  buildClassIdToNamespace,
  buildNamespacePackageStructure,
  createClassAndMethodsFactory,
  getNamespaceDisplayLabel
} from './orgTestItems';

const TEST_CONTROLLER_ID = 'sf.apex.testController';

// The suite/class/method/classToParent maps live in ApexTestTreeService Refs (single source of truth).
// These read the live Map object via a synchronous Ref read; reset clears them in place, so callers that
// mutate the returned map (removeClassFromTree.delete, diffClassMethods.set) keep writing through to the
// service. The shell applyStaleTags reads through the same accessors.
const suiteItems = (): Map<string, vscode.TestItem> =>
  getApexTestingRuntime().runSync(ApexTestTreeService.getSuiteItems());
const classItems = (): Map<string, vscode.TestItem> =>
  getApexTestingRuntime().runSync(ApexTestTreeService.getClassItems());
const methodItems = (): Map<string, vscode.TestItem> =>
  getApexTestingRuntime().runSync(ApexTestTreeService.getMethodItems());
const classToParentItem = (): Map<string, vscode.TestItem> =>
  getApexTestingRuntime().runSync(ApexTestTreeService.getClassToParentItem());

/** Apex test class name for the given file URI, if it is a known test class. */
export const getTestClassName = (uri: URI): string | undefined => {
  const uriStr = uri.toString();
  for (const [className, item] of classItems()) {
    if (item.uri?.toString() === uriStr) {
      return className;
    }
  }
  return undefined;
};

/** Clear all suite children so they re-query from the org. */
export const clearAllSuiteChildren = (): void => {
  for (const suiteItem of suiteItems().values()) {
    suiteItem.children.replace([]);
  }
};

export class ApexTestController {
  private controller: vscode.TestController;
  private connection: Connection | undefined;
  private testService: TestService | undefined;
  // suiteToClasses STAYS a shell field in 4.1: its only writers (resolveSuiteChildren/clearTestItems)
  // are out-of-scope; moving it to a service Ref while its writer stays on shell would diverge.
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
    this.invalidateConnection();
    this.clearTestItems();
    await getApexTestingRuntime().runPromise(ApexTestTreeService.clearRestoredResults());
  }

  /** Build the per-invocation runtime data the tree service needs (vscode objects + shell callbacks). */
  private buildDiscoveryContext(): DiscoveryContext {
    return {
      controller: this.controller,
      suiteTag: this.suiteTag,
      orgOnlyTag: this.orgOnlyTag,
      inWorkspaceTag: this.inWorkspaceTag,
      sessionStartTime: this.sessionStartTime,
      ensureInitialized: () => this.ensureInitialized(),
      clearTree: () => this.clearTestItems(),
      getConnection: () => this.getConnection(),
      getTestService: () => this.getTestService(),
      persistDiscoveredClasses: classes => this.persistDiscoveredClasses(classes),
      updateTestResults: uri =>
        getApexTestingRuntime().runPromise(
          ApexTestExecutionService.updateTestResults(this.buildExecutionContext(), uri)
        ),
      applyStaleTags: staleMethodIds => this.applyStaleTags(staleMethodIds),
      getMethodIdsFromResultFile: uri => ApexTestController.getMethodIdsFromResultFile(uri)
    };
  }

  // eslint-disable-next-line class-methods-use-this
  public async clearResults(): Promise<void> {
    void vscode.commands.executeCommand('testing.clearTestResults');

    // Non-fatal: result folder may not exist yet, or deletion may fail. Log + continue.
    await getApexTestingRuntime().runPromise(
      Effect.fn('ApexTestController.clearResults')(function* () {
        const api = yield* (yield* ExtensionProviderService).getServicesApi;
        const resultDir = yield* getTestResultsFolder();
        yield* api.services.FsService.safeDelete(resultDir, { recursive: true });
      })().pipe(
        Effect.catchTags({
          NoDefaultOrgError: error => Effect.logWarning('Failed to delete test results folder', { error }),
          NoWorkspaceOpenError: error => Effect.logWarning('Failed to delete test results folder', { error }),
          ServicesExtensionNotFoundError: error => Effect.logWarning('Failed to delete test results folder', { error }),
          InvalidServicesApiError: error => Effect.logWarning('Failed to delete test results folder', { error })
        })
      )
    );
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
    // Single-shot dedup + catchTags-based failure notification live in the tree service (discover).
    await getApexTestingRuntime().runPromise(ApexTestTreeService.discover(this.buildDiscoveryContext()));
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
    for (const [methodId, methodItem] of methodItems()) {
      if (staleMethodIds && !staleMethodIds.has(methodId)) {
        continue;
      }
      const existingTags = methodItem.tags ?? [];
      if (!existingTags.some(t => t.id === 'stale')) {
        methodItem.tags = [...existingTags, this.staleTag!];
      }
    }

    // Propagate stale tag to class items that have any stale methods
    for (const [className, classItem] of classItems()) {
      const classPrefix = `${className}.`;
      const hasStaleMethod = [...methodItems().entries()].some(
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
    for (const [suiteName, suiteItem] of suiteItems()) {
      const classNames = this.suiteToClasses.get(suiteName);
      if (classNames) {
        const hasStaleClass = [...classNames].some(cn => {
          const classItem = classItems().get(cn);
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
        clearAllSuiteChildren();
      }
    } catch (e) {
      // Non-fatal: incremental update failure doesn't affect existing tree state
      console.warn('Incremental test-tree update failed (non-fatal):', e);
    }
  }

  private removeClassFromTree(fullClassName: string): void {
    const classItem = classItems().get(fullClassName);
    if (!classItem) {
      return;
    }

    // Remove method items
    classItem.children.forEach(methodItem => {
      methodItems().delete(methodItem.id);
    });

    // Remove class from parent
    const parentItem = classToParentItem().get(fullClassName);
    if (parentItem) {
      parentItem.children.delete(classItem.id);
      // Clean up empty parent nodes
      if (parentItem.children.size === 0) {
        this.removeEmptyAncestors(parentItem);
      }
    }

    classItems().delete(fullClassName);
    classToParentItem().delete(fullClassName);
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
      const existingClassItem = classItems().get(fullName);

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
      classItems: classItems(),
      methodItems: methodItems(),
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
          classToParentItem().set(fcn, packageItem);
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
        methodItems().delete(methodItem.id);
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
        methodItems().set(methodId, methodItem);
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

  // Watcher boundary: the execution service owns the dedup (lastProcessedResultFile Ref) + result apply.
  public async onResultFileCreate(apexTestDir: URI, testResultUri: URI): Promise<void> {
    await getApexTestingRuntime().runPromise(
      ApexTestExecutionService.onResultFileCreate(this.buildExecutionContext(), apexTestDir, testResultUri)
    );
  }

  private clearTestItems(): void {
    void vscode.commands.executeCommand('testing.clearTestResults');
    this.controller.items.replace([]);
    // The suite/class/method/classToParent maps live in the tree service; reset clears them in place.
    getApexTestingRuntime().runSync(ApexTestTreeService.reset());
    this.suiteToClasses.clear();
  }

  private invalidateConnection(): void {
    this.connection = undefined;
    this.testService = undefined;
    getOrgApexClassProvider().clearAllCache();
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
        getApexTestingRuntime().runSync(Effect.logDebug('No test classes found for suite', { suiteName }));
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
        const existingClassItem = classItems().get(className);
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

  /** Build the per-invocation runtime data the execution service needs (sibling to buildDiscoveryContext). */
  private buildExecutionContext(): ExecutionContext {
    return {
      controller: this.controller,
      orgOnlyTag: this.orgOnlyTag,
      inWorkspaceTag: this.inWorkspaceTag,
      ensureInitialized: () => this.ensureInitialized(),
      getTestService: () => this.getTestService(),
      resolveSuiteChildren: suiteItem => this.resolveSuiteChildren(suiteItem),
      getSuiteToClasses: () => this.suiteToClasses
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
