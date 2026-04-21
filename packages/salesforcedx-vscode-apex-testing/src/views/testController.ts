/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ToolingTestClass } from '../testDiscovery/schemas';
import { TestLevel, TestResult, TestService } from '@salesforce/apex-node';
import type { Connection } from '@salesforce/core';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { getConnection, getDefaultOrgInfo } from '../coreExtensionUtils';
import { getApexTestDiscoveryStore, resolveDiscoveryOrgKey } from '../discoveryVfs/apexTestDiscoveryStore';
import { APEX_TESTING_SCHEME } from '../discoveryVfs/apexTestingDiscoveryFs';
import { nls } from '../messages';
import { getApexTestingRuntime } from '../services/extensionProvider';
import * as settings from '../settings';
import { telemetryService } from '../telemetry/telemetry';
import { resolvePackage2Members } from '../testDiscovery/packageResolution';
import { discoverTests } from '../testDiscovery/testDiscovery';
import { toUserFriendlyApexTestError } from '../utils/apexTestErrorMapper';
import { notificationService } from '../utils/notificationHelpers';
import { getOrgApexClassProvider } from '../utils/orgApexClassProvider';
import { getTestResultsFolder } from '../utils/pathHelpers';
import { buildTestPayload } from '../utils/payloadBuilder';
import {
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
  isSuite
} from '../utils/testItemUtils';
import { writeAndOpenTestReport } from '../utils/testReportGenerator';
import { updateTestRunResults } from '../utils/testResultProcessor';
import {
  buildClassToUriIndex,
  getFullClassName,
  getMethodLocationsFromSymbols,
  isFlowTest,
  readTestRunIdFile,
  writeTestResultJsonFile
} from '../utils/testUtils';
import {
  type MetadataRetrieveFileResponse,
  isMetadataRetrieveFileResponse,
  isMetadataRetrieveOutcomeLike
} from '../utils/typeGuards';
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
type ApexTestRunScope = 'workspace-first' | 'all-org';

export class ApexTestController {
  private controller: vscode.TestController;
  private suiteItems: Map<string, vscode.TestItem> = new Map();
  private classItems: Map<string, vscode.TestItem> = new Map();
  private methodItems: Map<string, vscode.TestItem> = new Map();
  private suiteParentItem: vscode.TestItem | undefined;
  private lastProcessedResultFile: URI | null = null;
  private connection: Connection | undefined;
  private testService: TestService | undefined;
  private suiteToClasses: Map<string, Set<string>> = new Map();
  private inWorkspaceTag: vscode.TestTag | undefined;
  private orgOnlyTag: vscode.TestTag | undefined;
  private suiteTag: vscode.TestTag | undefined;

  constructor() {
    this.controller = vscode.tests.createTestController(TEST_CONTROLLER_ID, nls.localize('test_view_name'));
    // Create a tag for tests that exist in both workspace and org (enables filtering in Test Explorer)
    this.inWorkspaceTag = new vscode.TestTag('in-workspace');
    // Create a tag for org-only tests (tests that exist in org but not in local workspace)
    this.orgOnlyTag = new vscode.TestTag('org-only');
    // Create a tag for test suites
    this.suiteTag = new vscode.TestTag('test-suite');
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
    this.clearTestItems();
    await this.discoverTests();
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
    try {
      // Initialize connection and testService
      await this.ensureInitialized();

      // Clear existing test items before repopulating (important when switching orgs)
      this.clearTestItems();

      // Populate suites first so they appear at the top
      await this.populateSuiteItems();

      // Then populate test classes from org (all tests, not just local)
      const discoveryResult = await getApexTestingRuntime().runPromise(discoverTests());
      await this.persistDiscoveredClasses(discoveryResult.classes);

      // Always populate whatever classes were discovered, even if discovery was partial
      if (discoveryResult.classes.length > 0) {
        await this.populateTestItemsFromOrg(discoveryResult.classes);
      }
    } catch (error) {
      console.debug('Failed to discover tests:', error);
      const friendlyMessage = toUserFriendlyApexTestError(error);
      if (friendlyMessage === nls.localize('apex_test_discovery_partial_warning')) {
        void notificationService.showWarningMessage(friendlyMessage);
      } else {
        void notificationService.showErrorMessage(friendlyMessage);
      }
    }
  }

  private async persistDiscoveredClasses(classes: ToolingTestClass[]): Promise<void> {
    try {
      const orgInfo = await getDefaultOrgInfo();
      const orgKey = resolveDiscoveryOrgKey(orgInfo);
      const apexClasses = classes.filter(cls => cls.testMethods?.length > 0 && !isFlowTest(cls));
      const classBodiesByFullName = await this.fetchClassBodiesByFullName(apexClasses);
      getApexTestDiscoveryStore().saveDiscoveredClasses(orgKey, apexClasses, classBodiesByFullName);
    } catch (error) {
      console.debug('Failed to persist discovered Apex classes into apex-testing VFS:', error);
    }
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
      const queryResult = await connection.tooling.query<{ Name: string; NamespacePrefix?: string | null; Body?: string | null }>(
        query
      );
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
    this.suiteParentItem = undefined;
    this.suiteToClasses.clear();
    // Clear cached connection and testService so they're re-fetched for the new org
    this.connection = undefined;
    this.testService = undefined;
    // Clear org class body cache since we're switching orgs
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
    const orgKey = resolveDiscoveryOrgKey(orgInfo);
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
      this.suiteParentItem = this.controller.createTestItem(suiteParentId, nls.localize('apex_test_suites_parent_text'), undefined);
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
          return yield* api.services.MetadataRetrieveService.retrieve(
            [{ type: 'ApexClass', fullName: className }],
            { ignoreConflicts: true }
          );
        })
      );

      if (typeof result === 'string') {
        await notificationService.showInformationMessage(nls.localize('apex_test_retrieve_canceled'));
        return;
      }

      const retrievedFileUri = getRetrievedFileUri(result);
      if (retrievedFileUri) {
        const document = await vscode.workspace.openTextDocument(retrievedFileUri);
        await vscode.window.showTextDocument(document, {
          preview: false,
          viewColumn: vscode.ViewColumn.Active,
          preserveFocus: false
        });
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
    const startTime = Date.now();
    const run = this.controller.createTestRun(request);
    let testsToRun = gatherTests(request, this.controller.items, this.suiteItems);

    // Implicit full run: no explicit selection. Restrict to in-workspace tests for the default Run/Debug profiles.
    // When the user (or explorer filter) supplies request.include, run exactly that set—e.g. filtered-visible tests.
    const isImplicitFullRun = !request.include?.length;
    if (runScope === 'workspace-first' && isImplicitFullRun && this.inWorkspaceTag) {
      testsToRun = testsToRun.filter(test => test.tags?.includes(this.inWorkspaceTag!));
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

      const durationMs = Date.now() - startTime;
      const testCount = testsToRun.length;
      telemetryService.sendEventData(
        'apexTestRun',
        { trigger: 'testController', isDebug: String(isDebug) },
        {
          durationMs,
          testsRan: testCount
        }
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
          if (isClass(test.id) && getTestName(test) === className) {
            run.errored(test, new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', friendlyMessage)));
          } else if (isMethod(test.id) && extractClassName(test.id) === className) {
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

    // Write JSON test result file
    await writeTestResultJsonFile(result, outputDir, codeCoverage);

    // Generate and open test report
    const reportStartTime = Date.now();
    const outputFormat = settings.retrieveOutputFormat();
    const sortOrder = settings.retrieveTestSortOrder();
    try {
      await getApexTestingRuntime().runPromise(
        writeAndOpenTestReport(result, outputDir, outputFormat, codeCoverage, sortOrder)
      );
      const reportDurationMs = Date.now() - reportStartTime;
      telemetryService.sendEventData(
        'apexTestReportGenerated',
        { outputFormat, trigger: 'testExplorer' },
        { reportDurationMs }
      );
    } catch (error) {
      console.error('Failed to generate test report:', error);
      // Continue even if report generation fails
    }

    // Update test results in Test Explorer
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
    try {
      const resultText = await getApexTestingRuntime().runPromise(
        Effect.gen(function* () {
          const api = yield* (yield* ExtensionProviderService).getServicesApi;
          return yield* api.services.FsService.readFile(testResultUri);
        })
      );
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const resultContent = JSON.parse(resultText) as TestResult;

      // Create a test run to update results
      const run = this.controller.createTestRun(new vscode.TestRunRequest());

      // Reuse updateTestRunResults - pass empty array for testsToRun since we're loading from file
      // Use the code coverage setting to determine if coverage should be shown
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

      run.end();
    } catch (error) {
      const friendlyMessage = toUserFriendlyApexTestError(error);
      throw new Error(nls.localize('apex_test_update_results_failed_message', friendlyMessage));
    }
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
  const document = await vscode.workspace.openTextDocument(test.uri);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    viewColumn: vscode.ViewColumn.Active
  });
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

const getRetrievedFileUri = (result: unknown): URI | undefined => {
  if (!isMetadataRetrieveOutcomeLike(result)) {
    return undefined;
  }
  let responses: readonly MetadataRetrieveFileResponse[];
  try {
    responses = result.getFileResponses();
  } catch {
    return undefined;
  }
  if (!Array.isArray(responses) || responses.length === 0) {
    return undefined;
  }
  for (const item of responses) {
    if (!isMetadataRetrieveFileResponse(item)) {
      continue;
    }
    const { filePath } = item;
    if (typeof filePath === 'string' && filePath.length > 0) {
      return URI.file(filePath);
    }
  }
  return undefined;
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
    return await getTestResultsFolder();
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
