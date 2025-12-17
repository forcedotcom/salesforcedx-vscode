/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ToolingTestClass } from '../testDiscovery/schemas';
import { ResultFormat, TestResult, TestService } from '@salesforce/apex-node';
import type { Connection } from '@salesforce/core';
import { getTestResultsFolder, notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { getVscodeCoreExtension } from '../coreExtensionUtils';
import { nls } from '../messages';
import * as settings from '../settings';
import { telemetryService } from '../telemetry/telemetry';
import { discoverTests, sourceIsLS } from '../testDiscovery/testDiscovery';
import { createOrgApexClassUri, openOrgApexClass } from '../utils/orgApexClassProvider';
import { buildTestPayload } from '../utils/payloadBuilder';
import {
  createClassId,
  createMethodId,
  createSuiteClassId,
  createSuiteId,
  extractClassName,
  extractSuiteName,
  getTestName,
  isClass,
  isMethod,
  isSuite,
  gatherTests
} from '../utils/testItemUtils';
import { writeAndOpenTestReport } from '../utils/testReportGenerator';
import { updateTestRunResults } from '../utils/testResultProcessor';
import { buildClassToUriIndex, fetchFromLs, getFullClassName, isFlowTest } from '../utils/testUtils';
import { ApexTestMethod } from './lspConverter';

const TEST_CONTROLLER_ID = 'sf.apex.testController';
const TEST_RUN_ID_FILE = 'test-run-id.txt';
const TEST_RESULT_JSON_FILE = 'test-result.json';

export class ApexTestController {
  private controller: vscode.TestController;
  private testItems: Map<string, vscode.TestItem> = new Map();
  private suiteItems: Map<string, vscode.TestItem> = new Map();
  private classItems: Map<string, vscode.TestItem> = new Map();
  private methodItems: Map<string, vscode.TestItem> = new Map();
  private suiteParentItem: vscode.TestItem | undefined;
  private resultFileWatcher: vscode.FileSystemWatcher | undefined;
  private lastProcessedResultFile: string | null = null;
  private connection: Connection | undefined;
  private testService: TestService | undefined;
  private suiteToClasses: Map<string, Set<string>> = new Map();
  private localOnlyTag: vscode.TestTag | undefined;
  private orgOnlyTag: vscode.TestTag | undefined;
  private suiteTag: vscode.TestTag | undefined;

  constructor() {
    this.controller = vscode.tests.createTestController(TEST_CONTROLLER_ID, nls.localize('test_view_name'));
    // Create a tag for local-only tests (tests that exist locally but not in org)
    this.localOnlyTag = new vscode.TestTag('local-only');
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

    const vscodeCoreExtension = await getVscodeCoreExtension();
    this.connection = await vscodeCoreExtension.exports.WorkspaceContext.getInstance().getConnection();
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

      // Populate suites first so they appear at the top
      await this.populateSuiteItems();
      // Then populate test classes from org (all tests, not just local)
      const discoveryResult = await discoverTests({ showAllMethods: true });
      await this.populateTestItemsFromOrg(discoveryResult.classes);
      // Finally, populate local-only tests (tests in local workspace but not in org)
      // Only do this when using Language Server discovery, as API discovery already shows all org tests
      if (sourceIsLS()) {
        await this.populateLocalOnlyTests(discoveryResult.classes);
      }
    } catch (error) {
      console.debug('Failed to discover tests:', error);
    }
  }

  public async onResultFileCreate(apexTestPath: string, testResultFile: string): Promise<void> {
    const testRunIdFile = path.join(apexTestPath, TEST_RUN_ID_FILE);
    const fs = vscode.workspace.fs;
    let testRunId: string | undefined;
    try {
      const testRunIdData = await fs.readFile(vscode.Uri.file(testRunIdFile));
      testRunId = Buffer.from(testRunIdData).toString('utf-8').trim();
    } catch {
      // test-run-id.txt might not exist
    }

    const testResultFilePath = path.join(
      apexTestPath,
      testRunId ? `test-result-${testRunId}.json` : TEST_RESULT_JSON_FILE
    );

    if (testResultFile === testResultFilePath) {
      if (this.lastProcessedResultFile === testResultFilePath) {
        return;
      }
      this.lastProcessedResultFile = testResultFilePath;
      await this.updateTestResults(testResultFile);
    }
  }

  private clearTestItems(): void {
    this.controller.items.replace([]);
    this.testItems.clear();
    this.suiteItems.clear();
    this.classItems.clear();
    this.methodItems.clear();
    this.suiteParentItem = undefined;
    this.suiteToClasses.clear();
  }

  /**
   * Populate test items from org test classes (Tooling API).
   * Shows all test classes in the org, even if they're not in the local workspace.
   */
  private async populateTestItemsFromOrg(classes: ToolingTestClass[]): Promise<void> {
    // Filter to only Apex test classes (not Flow tests) and those with test methods
    const apexClasses = classes.filter(cls => cls.testMethods?.length > 0 && !isFlowTest(cls));

    if (apexClasses.length === 0) {
      return;
    }

    // Build a map of class names to URIs for classes that exist locally
    const classNames = apexClasses.map(cls => cls.name);
    const classNameToUri = await buildClassToUriIndex(classNames);

    // Group classes by full name (with namespace if present)
    const classMap = new Map<string, ToolingTestClass[]>();
    for (const cls of apexClasses) {
      const fullClassName = getFullClassName(cls);
      const existing = classMap.get(fullClassName) ?? [];
      existing.push(cls);
      classMap.set(fullClassName, existing);
    }

    // Create test items for all classes
    for (const [fullClassName, classEntries] of classMap) {
      // Use the first entry's name as the base class name
      const baseClassName = classEntries[0].name;
      // Try to find a local URI for this class
      // If the class doesn't exist locally, use a virtual document URI for org-only classes
      const localUri = classNameToUri.get(baseClassName);
      const uri = localUri ?? createOrgApexClassUri(baseClassName);
      const isOrgOnly = !localUri;

      // Create class item
      // For org-only classes, use virtual document URI so they can be opened
      const classItem = this.controller.createTestItem(createClassId(fullClassName), fullClassName, uri);
      classItem.canResolveChildren = false;
      // Tag tests that exist in org but not in local workspace
      if (isOrgOnly && this.orgOnlyTag) {
        classItem.tags = [this.orgOnlyTag];
      }
      this.classItems.set(fullClassName, classItem);

      // Collect all unique test methods from all entries (in case of duplicates)
      const methodNames = new Set<string>();
      for (const entry of classEntries) {
        for (const testMethod of entry.testMethods ?? []) {
          methodNames.add(testMethod.name);
        }
      }

      // Create method items
      for (const methodName of methodNames) {
        const methodId = `${fullClassName}.${methodName}`;
        // Use line/column from Tooling API if available, otherwise default to (0,0)
        const line = classEntries[0].testMethods?.find(m => m.name === methodName)?.line ?? 0;
        const column = classEntries[0].testMethods?.find(m => m.name === methodName)?.column ?? 0;
        const position = new vscode.Position(Math.max(0, line - 1), Math.max(0, column - 1));
        // Set range for both local and org-only classes (virtual documents support ranges)
        const range = new vscode.Range(position, position);

        // Create method item
        // For org-only classes, use virtual document URI so they can be opened
        const methodItem = this.controller.createTestItem(createMethodId(fullClassName, methodName), methodName, uri);
        methodItem.range = range;
        methodItem.canResolveChildren = false;
        // Tag tests that exist in org but not in local workspace
        if (isOrgOnly && this.orgOnlyTag) {
          methodItem.tags = [this.orgOnlyTag];
        }
        this.methodItems.set(methodId, methodItem);
        classItem.children.add(methodItem);
      }

      this.controller.items.add(classItem);
      this.testItems.set(createClassId(fullClassName), classItem);
    }
  }

  /**
   * Populate test items for tests that exist locally but not in the org.
   * These tests are marked with a tag to indicate they're local-only and cannot be run.
   */
  private async populateLocalOnlyTests(orgClasses: ToolingTestClass[]): Promise<void> {
    try {
      const result = await fetchFromLs();
      const localTests = result.tests;

      if (localTests.length === 0) {
        return;
      }

      // Build a set of class names that exist in the org (for comparison)
      const orgClassNames = new Set<string>();
      for (const cls of orgClasses) {
        const fullClassName = getFullClassName(cls);
        orgClassNames.add(fullClassName);
        // Also add just the base name (without namespace) for comparison
        orgClassNames.add(cls.name);
      }

      // Group local tests by class
      const localClassMap = new Map<string, { tests: ApexTestMethod[]; uri: vscode.Uri }>();
      for (const test of localTests) {
        const className = test.definingType;
        if (!localClassMap.has(className)) {
          localClassMap.set(className, { tests: [], uri: test.location.uri });
        }
        const classData = localClassMap.get(className);
        if (classData) {
          classData.tests.push(test);
        }
      }

      // Create test items for classes that are local but not in org
      for (const [className, classData] of localClassMap) {
        // Skip if this class already exists in org (was added by populateTestItemsFromOrg)
        if (orgClassNames.has(className) || this.classItems.has(className)) {
          continue;
        }

        // Create class item with local-only tag
        const classItem = this.controller.createTestItem(createClassId(className), className, classData.uri);
        classItem.canResolveChildren = false;
        if (this.localOnlyTag) {
          classItem.tags = [this.localOnlyTag];
        }
        this.classItems.set(className, classItem);

        // Create method items
        for (const test of classData.tests) {
          const methodName = test.methodName;
          const methodId = `${className}.${methodName}`;
          const methodItem = this.controller.createTestItem(
            createMethodId(className, methodName),
            methodName,
            test.location.uri
          );
          methodItem.range = test.location.range;
          methodItem.canResolveChildren = false;
          if (this.localOnlyTag) {
            methodItem.tags = [this.localOnlyTag];
          }
          this.methodItems.set(methodId, methodItem);
          classItem.children.add(methodItem);
        }

        this.controller.items.add(classItem);
        this.testItems.set(createClassId(className), classItem);
      }
    } catch (error) {
      // If local test discovery fails, just log and continue
      // This shouldn't block showing org tests
      console.debug('Failed to discover local-only tests:', error);
    }
  }

  private async populateSuiteItems(): Promise<void> {
    try {
      // Ensure connection and testService are initialized
      await this.ensureInitialized();
      const suites = await this.getTestService().retrieveAllSuites();

      if (suites.length === 0) {
        return;
      }

      // Create parent "Apex Test Suites" node
      const suiteParentId = 'apex-test-suites-parent';
      this.suiteParentItem = this.controller.createTestItem(suiteParentId, 'Apex Test Suites', undefined);
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
        this.testItems.set(suiteId, suiteItem);
      }

      // Add the parent item first so it appears at the top
      this.controller.items.add(this.suiteParentItem);
    } catch (error) {
      throw new Error(nls.localize('apex_test_populate_suite_items_failed_message', String(error)));
    }
  }

  private setupRunProfiles(): void {
    // Run profile
    this.controller.createRunProfile(nls.localize('run_tests_title'), vscode.TestRunProfileKind.Run, (request, token) =>
      this.runTests(request, token, false)
    );

    // Debug profile
    this.controller.createRunProfile(
      nls.localize('debug_tests_title'),
      vscode.TestRunProfileKind.Debug,
      (request, token) => this.runTests(request, token, true)
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
    };
  }

  /**
   * Opens an org-only test class in a virtual editor
   */
  public async openOrgOnlyTest(test: vscode.TestItem): Promise<void> {
    const className = getTestName(test);

    if (isMethod(test.id)) {
      // For methods, extract class name and navigate to the method position
      const classNameFromMethod = extractClassName(test.id);
      if (classNameFromMethod) {
        // Get the line number from the test item's range if available
        const position = test.range?.start ?? new vscode.Position(0, 0);
        await openOrgApexClass(classNameFromMethod, position);
      } else {
        await openOrgApexClass(className);
      }
    } else if (isClass(test.id)) {
      // For classes, just open the class
      await openOrgApexClass(className);
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

    let classNames: string[] = [];

    try {
      // Ensure connection and testService are initialized
      await this.ensureInitialized();

      // Get test suite membership records (contains ApexClassId)
      const classesInSuite = await this.getTestService().getTestsInSuite(suiteName);

      if (classesInSuite.length === 0) {
        console.debug(`No test classes found for suite: ${suiteName}`);
        return;
      }

      // Extract class IDs and query for class names
      const classIds = classesInSuite.map(record => record.ApexClassId);
      const classNamesQuery = `SELECT Id, Name FROM ApexClass WHERE Id IN (${classIds.map(id => `'${id}'`).join(',')})`;
      const queryResult = await this.getConnection().tooling.query<{ Name: string }>(classNamesQuery);

      classNames = queryResult.records.map(record => record.Name);

      // Store the mapping of suite to classes
      this.suiteToClasses.set(suiteName, new Set(classNames));

      // Add class items as children of the suite
      // These are just for display - the actual class items remain at root level
      for (const className of classNames) {
        const existingClassItem = this.classItems.get(className);
        // Create a simple placeholder item for display under the suite
        const classItem = this.controller.createTestItem(
          createSuiteClassId(suiteName, className),
          className,
          existingClassItem?.uri
        );
        suiteItem.children.add(classItem);
      }
    } catch (error) {
      throw new Error(nls.localize('apex_test_resolve_suite_children_failed_message', suiteName, String(error)));
    }
  }

  private async runTests(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
    isDebug: boolean
  ): Promise<void> {
    const startTime = Date.now();
    const run = this.controller.createTestRun(request);
    let testsToRun = gatherTests(request, this.controller.items, this.suiteItems);
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

    // Check for local-only tests (tests that exist locally but not in org)
    // These tests cannot be run because they don't exist in the org
    if (this.localOnlyTag) {
      const localOnlyTests = testsToRun.filter(test => test.tags?.includes(this.localOnlyTag!));
      if (localOnlyTests.length > 0) {
        // Collect test names for the warning message
        const localOnlyTestNames = localOnlyTests.map(test => {
          const testName = getTestName(test);
          // For methods, show Class.Method; for classes, show ClassName
          return testName;
        });
        // Format as a simple list separated by newlines
        const testNamesList = localOnlyTestNames.join('\n');
        const introMessage = nls.localize('apex_test_local_only_warning_message', '').replace(': %s', '');
        const deployMessage = nls.localize('apex_test_local_only_warning_deploy_text');
        const message = `${introMessage}\n${testNamesList}\n${deployMessage}`;
        void notificationService.showWarningMessage(message);
      }
      // Filter out local-only tests
      testsToRun = testsToRun.filter(test => !test.tags?.includes(this.localOnlyTag!));
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
        const tmpFolder = await this.getTempFolder();
        const codeCoverage = settings.retrieveTestCodeCoverage();
        await this.executeTests(testNames, tmpFolder, codeCoverage, token, run, testsToRun);
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
      for (const test of testsToRun) {
        run.errored(test, new vscode.TestMessage(String(error)));
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

    // Group methods by their parent class to avoid calling debug command multiple times for the same class
    const classesToDebug = new Set<string>();
    const methodsToDebug = new Map<string, string[]>();

    for (const test of testsToDebug) {
      try {
        if (isMethod(test.id)) {
          // Extract class name from method ID (format: ClassName.MethodName)
          const testName = getTestName(test);
          const className = extractClassName(test.id);
          if (className) {
            // If we're debugging multiple methods from the same class, group them
            // and debug the class once instead of each method individually
            const existingMethods = methodsToDebug.get(className) ?? [];
            existingMethods.push(testName);
            methodsToDebug.set(className, existingMethods);
            classesToDebug.add(className);
          } else {
            // Fallback: debug single method if we can't extract class name
            await vscode.commands.executeCommand('sf.test.view.debugSingleTest', { name: testName });
          }
        } else if (isClass(test.id)) {
          // Debug class (all methods in class)
          const className = getTestName(test);
          classesToDebug.add(className);
        } else if (isSuite(test.id)) {
          // Suites cannot be debugged - only individual classes or methods can be debugged
          run.errored(test, new vscode.TestMessage(nls.localize('apex_test_suite_debug_not_supported_message')));
        }
      } catch (error) {
        run.errored(test, new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', String(error))));
      }
    }

    // Debug each class only once
    for (const className of classesToDebug) {
      try {
        await vscode.commands.executeCommand('sf.test.view.debugTests', { name: className });
      } catch (error) {
        // Find all tests from this class and mark them as errored
        for (const test of testsToDebug) {
          if (isClass(test.id) && getTestName(test) === className) {
            run.errored(test, new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', String(error))));
          } else if (isMethod(test.id) && extractClassName(test.id) === className) {
            run.errored(test, new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', String(error))));
          }
        }
      }
    }
  }

  private async executeTests(
    testNames: string[],
    outputDir: string,
    codeCoverage: boolean,
    token: vscode.CancellationToken,
    run: vscode.TestRun,
    testsToRun: vscode.TestItem[]
  ): Promise<void> {
    // Ensure connection and testService are initialized
    await this.ensureInitialized();

    const testService = this.getTestService();
    const { payload, hasSuite, hasClass } = await buildTestPayload(testService, testsToRun, testNames, codeCoverage);

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

    await testService.writeResultFiles(
      result,
      { resultFormats: [ResultFormat.json], dirPath: outputDir },
      codeCoverage
    );

    // Generate and open test report
    const reportStartTime = Date.now();
    const outputFormat = settings.retrieveOutputFormat();
    try {
      await writeAndOpenTestReport(result, outputDir, outputFormat);
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
    updateTestRunResults(result, run, testsToRun, this.methodItems, this.classItems, codeCoverage);

    // Show success notification
    const totalCount = result.summary.testsRan ?? 0;
    const failures = result.summary.failing ?? 0;

    // Determine execution name based on what was run (hasSuite and hasClass set above)
    let executionName: string;
    if (hasSuite) {
      executionName = nls.localize('apex_test_suite_run_text');
    } else if (hasClass) {
      executionName = nls.localize('apex_test_class_run_text');
    } else {
      executionName = nls.localize('apex_test_run_text');
    }
    if (failures === 0 && totalCount > 0) {
      void notificationService.showSuccessfulExecution(executionName, channelService);
    } else if (totalCount > 0) {
      notificationService.showFailedExecution(executionName);
    }
  }

  private async updateTestResults(testResultFilePath: string): Promise<void> {
    try {
      const fs = vscode.workspace.fs;
      const resultData = await fs.readFile(vscode.Uri.file(testResultFilePath));
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const resultContent = JSON.parse(Buffer.from(resultData).toString('utf-8')) as TestResult;

      // Create a test run to update results
      const run = this.controller.createTestRun(new vscode.TestRunRequest());

      // Reuse updateTestRunResults - pass empty array for testsToRun since we're loading from file
      // Use the code coverage setting to determine if coverage should be shown
      const codeCoverage = settings.retrieveTestCodeCoverage();
      updateTestRunResults(resultContent, run, [], this.methodItems, this.classItems, codeCoverage);

      run.end();
    } catch (error) {
      throw new Error(nls.localize('apex_test_update_results_failed_message', String(error)));
    }
  }

  private async getTempFolder(): Promise<string> {
    if (vscode.workspace?.workspaceFolders) {
      const apexDir = await getTestResultsFolder(vscode.workspace.workspaceFolders[0].uri.fsPath, 'apex');
      return apexDir;
    } else {
      throw new Error(nls.localize('cannot_determine_workspace'));
    }
  }

  public dispose(): void {
    this.resultFileWatcher?.dispose();
    this.controller.dispose();
  }
}

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
