/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { HumanReporter, ResultFormat, TestLevel, TestResult, TestService } from '@salesforce/apex-node';
import type { Connection } from '@salesforce/core';
import { getTestResultsFolder, notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { FAIL_RESULT, PASS_RESULT, SKIP_RESULT } from '../constants';
import { getVscodeCoreExtension } from '../coreExtensionUtils';
import { nls } from '../messages';
import * as settings from '../settings';
import { telemetryService } from '../telemetry/telemetry';
import { getApexTests } from '../utils/testUtils';
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

  constructor() {
    this.controller = vscode.tests.createTestController(TEST_CONTROLLER_ID, nls.localize('test_view_name'));
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
   */
  private async ensureInitialized(): Promise<void> {
    if (this.connection && this.testService) {
      return;
    }

    const vscodeCoreExtension = await getVscodeCoreExtension();
    this.connection = await vscodeCoreExtension.exports.WorkspaceContext.getInstance().getConnection();
    this.testService = new TestService(this.connection);
  }

  public async discoverTests(): Promise<void> {
    try {
      // Initialize connection and testService
      await this.ensureInitialized();

      // Populate suites first so they appear at the top
      await this.populateSuiteItems();
      // Then populate test classes
      const tests = await getApexTests();
      this.populateTestItems(tests);
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
  }

  private populateTestItems(tests: ApexTestMethod[]): void {
    const classMap = new Map<string, { tests: ApexTestMethod[]; uri: vscode.Uri }>();

    // Group tests by class
    for (const test of tests) {
      const className = test.definingType;
      if (!classMap.has(className)) {
        classMap.set(className, { tests: [], uri: test.location.uri });
      }
      classMap.get(className)!.tests.push(test);
    }

    // Create test items for classes and methods
    for (const [className, classData] of classMap) {
      const classItem = this.controller.createTestItem(`class:${className}`, className, classData.uri);
      classItem.canResolveChildren = false;
      this.classItems.set(className, classItem);

      for (const test of classData.tests) {
        const methodName = test.methodName;
        const methodId = `${className}.${methodName}`;
        const methodItem = this.controller.createTestItem(`method:${methodId}`, methodName, test.location.uri);
        methodItem.range = test.location.range;
        methodItem.canResolveChildren = false;
        this.methodItems.set(methodId, methodItem);
        classItem.children.add(methodItem);
      }

      this.controller.items.add(classItem);
      this.testItems.set(className, classItem);
    }
  }

  private async populateSuiteItems(): Promise<void> {
    try {
      // Ensure connection and testService are initialized
      await this.ensureInitialized();
      const suites = await this.testService!.retrieveAllSuites();

      if (suites.length === 0) {
        return;
      }

      // Create parent "Apex Test Suites" node
      const suiteParentId = 'apex-test-suites-parent';
      this.suiteParentItem = this.controller.createTestItem(suiteParentId, 'Apex Test Suites', undefined);

      // Add all suites as children of the parent
      for (const suite of suites) {
        const suiteItem = this.controller.createTestItem(
          `suite:${suite.TestSuiteName}`,
          suite.TestSuiteName,
          undefined
        );
        suiteItem.canResolveChildren = true;
        this.suiteItems.set(suite.TestSuiteName, suiteItem);
        this.suiteParentItem.children.add(suiteItem);
        this.testItems.set(`suite:${suite.TestSuiteName}`, suiteItem);
      }

      // Add the parent item first so it appears at the top
      this.controller.items.add(this.suiteParentItem);
    } catch (error) {
      throw new Error(`Failed to populate suite items: ${String(error)}`);
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
      if (test.id.startsWith('suite:')) {
        await this.resolveSuiteChildren(test);
      }
    };
  }

  private async resolveSuiteChildren(suiteItem: vscode.TestItem): Promise<void> {
    // If children are already populated, skip
    if (suiteItem.children.size > 0) {
      return;
    }

    const suiteName = suiteItem.id.replace('suite:', '');
    let classNames: string[] = [];

    try {
      // Ensure connection and testService are initialized
      await this.ensureInitialized();

      // Get test suite membership records (contains ApexClassId)
      const classesInSuite = await this.testService!.getTestsInSuite(suiteName);

      if (classesInSuite.length === 0) {
        console.debug(`No test classes found for suite: ${suiteName}`);
        return;
      }

      // Extract class IDs and query for class names
      const classIds = classesInSuite.map(record => record.ApexClassId);
      const classNamesQuery = `SELECT Id, Name FROM ApexClass WHERE Id IN (${classIds.map(id => `'${id}'`).join(',')})`;
      const queryResult = await this.connection!.tooling.query<{ Name: string }>(classNamesQuery);

      classNames = queryResult.records.map(record => record.Name);

      // Add class items as children of the suite
      // Note: We create items with unique IDs for suite children since TestItems can only have one parent
      for (const className of classNames) {
        const existingClassItem = this.classItems.get(className);
        let classItem: vscode.TestItem;

        if (existingClassItem) {
          // Class exists - create a reference item with a unique ID (TestItems can only have one parent)
          classItem = this.controller.createTestItem(
            `suite:${suiteName}:class:${className}`,
            className,
            existingClassItem.uri
          );
          classItem.canResolveChildren = false;
        } else {
          // Class not discovered yet - create a placeholder
          classItem = this.controller.createTestItem(`suite:${suiteName}:class:${className}`, className, undefined);
          classItem.canResolveChildren = false;
        }

        suiteItem.children.add(classItem);
      }
    } catch (error) {
      throw new Error(`Failed to resolve suite children for ${suiteName}: ${String(error)}`);
    }
  }

  private async runTests(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken,
    isDebug: boolean
  ): Promise<void> {
    const startTime = Date.now();
    const run = this.controller.createTestRun(request);
    const testsToRun = this.gatherTests(request);

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
        // Check if original request was for classes/suites (not expanded methods)
        const originalItems = request.include ? Array.from(request.include) : [];
        // Check if any original items are suite child items (suite:SuiteName:class:ClassName)
        const hasSuiteChildItems = originalItems.some(item => item.id.includes(':class:'));
        // Check if we have suite items (either the suite itself or suite children)
        const hasSuiteItems =
          originalItems.some(item => item.id.startsWith('suite:') && !item.id.includes(':class:')) ||
          testsToRun.some(item => item.id.startsWith('suite:') && !item.id.includes(':class:')) ||
          hasSuiteChildItems; // If suite child items are selected, treat as suite run
        // Check for regular class items (not suite children)
        const hasClassItems = originalItems.some(item => item.id.startsWith('class:') && !item.id.includes(':class:'));

        const testNames = testsToRun.map(test => this.getTestName(test));
        const tmpFolder = await this.getTempFolder();
        const codeCoverage = settings.retrieveTestCodeCoverage();
        await this.executeTests(testNames, tmpFolder, codeCoverage, token, run, testsToRun, {
          hasClassItems,
          hasSuiteItems,
          originalItems
        });
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
    // Group tests by type (class vs method)
    for (const test of testsToRun) {
      try {
        if (test.id.startsWith('method:')) {
          // Debug single method
          const testName = test.id.replace('method:', '');
          await vscode.commands.executeCommand('sf.test.view.debugSingleTest', { name: testName });
        } else if (test.id.startsWith('class:')) {
          // Debug class (all methods in class)
          const className = test.id.replace('class:', '');
          await vscode.commands.executeCommand('sf.test.view.debugTests', { name: className });
        } else if (test.id.startsWith('suite:')) {
          // Suites cannot be debugged - only individual classes or methods can be debugged
          run.errored(test, new vscode.TestMessage(nls.localize('apex_test_suite_debug_not_supported_message')));
        }
      } catch (error) {
        run.errored(test, new vscode.TestMessage(`Debug failed: ${String(error)}`));
      }
    }
  }

  private gatherTests(request: vscode.TestRunRequest): vscode.TestItem[] {
    const tests: vscode.TestItem[] = [];

    const include = (test: vscode.TestItem): void => {
      // Skip the suite parent node - it's just a container
      if (test.id === 'apex-test-suites-parent') {
        // Expand parent to get its children (suites)
        test.children.forEach(child => include(child));
        return;
      }
      // Don't expand suites - they should be run as-is
      // Also skip suite child class items (suite:SuiteName:class:ClassName) - they're just for display
      if (test.id.startsWith('suite:')) {
        // Check if it's a suite child (has :class: in the ID) - find parent suite instead
        if (test.id.includes(':class:')) {
          // Extract suite name from child item ID: suite:SuiteName:class:ClassName
          const parts = test.id.split(':class:');
          if (parts.length > 0 && parts[0].startsWith('suite:')) {
            const suiteName = parts[0].replace('suite:', '');
            // Find the parent suite using the suiteItems Map
            const parentSuite = this.suiteItems.get(suiteName);
            if (parentSuite) {
              tests.push(parentSuite);
              return;
            }
          }
          return; // Skip suite child items if parent not found
        }
        tests.push(test);
      } else if (test.children.size > 0) {
        // Expand classes to their methods
        test.children.forEach(child => include(child));
      } else {
        // Leaf node (method)
        tests.push(test);
      }
    };

    if (request.include) {
      for (const test of request.include) {
        include(test);
      }
    } else {
      this.controller.items.forEach(test => include(test));
    }

    if (request.exclude) {
      const excludeSet = new Set(request.exclude);
      return tests.filter(test => !excludeSet.has(test));
    }

    return tests;
  }

  private getTestName(test: vscode.TestItem): string {
    // For method items, return full name (Class.Method)
    if (test.id.startsWith('method:')) {
      return test.id.replace('method:', '');
    }
    // For class items, return class name
    if (test.id.startsWith('class:')) {
      return test.id.replace('class:', '');
    }
    // For suite child items (suite:SuiteName:class:ClassName), extract just the class name
    if (test.id.includes(':class:')) {
      const parts = test.id.split(':class:');
      if (parts.length > 1) {
        return parts[1]; // Return just the class name
      }
    }
    // For suite items, we need to collect all methods from children
    if (test.id.startsWith('suite:')) {
      const suiteName = test.id.replace('suite:', '');
      // For suites, we'll use the suite name and let the test service handle it
      return suiteName;
    }
    return test.label;
  }

  private async executeTests(
    testNames: string[],
    outputDir: string,
    codeCoverage: boolean,
    token: vscode.CancellationToken,
    run: vscode.TestRun,
    testsToRun: vscode.TestItem[],
    context?: { hasClassItems: boolean; hasSuiteItems: boolean; originalItems: vscode.TestItem[] }
  ): Promise<void> {
    // Ensure connection and testService are initialized
    await this.ensureInitialized();

    let payload;

    // Check if we're running a suite (from original request or in testsToRun)
    if (context?.hasSuiteItems) {
      let suiteName: string | undefined;

      // First try to find the suite item itself in testsToRun (most common case)
      let suiteItem = testsToRun.find(item => item.id.startsWith('suite:') && !item.id.includes(':class:'));
      // If not found, check originalItems
      suiteItem ??= context.originalItems.find(item => item.id.startsWith('suite:') && !item.id.includes(':class:'));

      if (suiteItem) {
        suiteName = suiteItem.id.replace('suite:', '');
      } else {
        // If not found, check if we have suite child items - extract suite name from them
        // Check both originalItems and testsToRun for suite child items
        const suiteChildItem =
          context.originalItems.find(item => item.id.includes(':class:')) ??
          testsToRun.find(item => item.id.includes(':class:'));

        if (suiteChildItem) {
          // Extract suite name from child item ID: suite:SuiteName:class:ClassName
          const parts = suiteChildItem.id.split(':class:');
          if (parts.length > 0 && parts[0].startsWith('suite:')) {
            suiteName = parts[0].replace('suite:', '');
          }
        }
      }

      if (suiteName) {
        // Running a suite - use the 4th parameter for suite name
        payload = await this.testService!.buildAsyncPayload(
          TestLevel.RunSpecifiedTests,
          undefined,
          undefined,
          suiteName, // Suite name goes in 4th parameter
          undefined,
          !codeCoverage
        );
      } else {
        console.debug(
          'Suite detection failed. originalItems:',
          context.originalItems.map(i => i.id)
        );
        console.debug(
          'Suite detection failed. testsToRun:',
          testsToRun.map(i => i.id)
        );
        throw new Error(nls.localize('apex_test_suite_name_not_determined_message'));
      }
    } else if (context?.hasClassItems) {
      // Class was selected - get class name from original item
      const classItem = context.originalItems.find(item => item.id.startsWith('class:'));
      if (classItem) {
        const className = classItem.id.replace('class:', '');
        // Running entire class - use class name parameter
        payload = await this.testService!.buildAsyncPayload(
          TestLevel.RunSpecifiedTests,
          undefined,
          className, // Class name in 3rd parameter
          undefined,
          undefined,
          !codeCoverage
        );
      }
    } else {
      // Running individual methods or mixed
      const methodNames = testNames.filter(name => name.includes('.'));
      const classNames = testNames.filter(name => !name.includes('.'));

      if (classNames.length > 0) {
        // Running entire classes - use class name parameter
        // Note: buildAsyncPayload only supports one class at a time
        payload = await this.testService!.buildAsyncPayload(
          TestLevel.RunSpecifiedTests,
          undefined,
          classNames[0], // Class name in 3rd parameter
          undefined,
          undefined,
          !codeCoverage
        );
      } else if (methodNames.length > 0) {
        // Check if all methods belong to the same class
        const classes = new Set(methodNames.map(name => name.split('.')[0]));
        if (classes.size === 1) {
          // All methods from same class - use class name parameter for efficiency
          const className = Array.from(classes)[0];
          payload = await this.testService!.buildAsyncPayload(
            TestLevel.RunSpecifiedTests,
            undefined,
            className, // Class name in 3rd parameter
            undefined,
            undefined,
            !codeCoverage
          );
        } else {
          // Multiple classes - use method names
          payload = await this.testService!.buildAsyncPayload(
            TestLevel.RunSpecifiedTests,
            methodNames.join(','), // Method names in 2nd parameter
            undefined,
            undefined,
            undefined,
            !codeCoverage
          );
        }
      }
    }

    if (!payload) {
      throw new Error(nls.localize('apex_test_payload_build_failed_message'));
    }

    // TODO: fix in apex-node W-18453221
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = (await this.testService!.runTestAsynchronous(
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

    await this.testService!.writeResultFiles(
      result,
      { resultFormats: [ResultFormat.json], dirPath: outputDir },
      codeCoverage
    );

    // Format and display test results in output channel (like the old view)
    const humanOutput = new HumanReporter().format(result, codeCoverage, false);
    channelService.appendLine(humanOutput);
    channelService.showChannelOutput(); // Show the output channel automatically

    // Update test results in Test Explorer
    this.updateTestRunResults(result, run, testsToRun);

    // Show success notification
    const totalCount = result.summary.testsRan ?? 0;
    const failures = result.summary.failing ?? 0;

    // Determine execution name based on what was run
    let executionName: string;
    if (context?.hasSuiteItems) {
      executionName = nls.localize('apex_test_suite_run_text');
    } else if (context?.hasClassItems) {
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

  private updateTestRunResults(result: TestResult, run: vscode.TestRun, testsToRun: vscode.TestItem[]): void {
    // Build a map of test names to test items from all available items
    // This ensures we can match results even if the suite wasn't expanded
    const testMap = new Map<string, vscode.TestItem>();

    // Add all method items to the map (keyed by full name: Class.Method)
    for (const [methodName, methodItem] of this.methodItems) {
      testMap.set(methodName, methodItem);
    }

    // Also add items from testsToRun (for methods that might not be in methodItems yet)
    for (const test of testsToRun) {
      if (test.id.startsWith('method:')) {
        const testName = test.id.replace('method:', '');
        testMap.set(testName, test);
      }
    }

    // Track which items we've updated so we can handle suites/classes
    const updatedItems = new Set<vscode.TestItem>();

    // Update results from TestResult
    for (const testResult of result.tests) {
      const { name, namespacePrefix } = testResult.apexClass;
      const apexClassName = namespacePrefix ? `${namespacePrefix}.${name}` : name;
      const fullTestName = `${apexClassName}.${testResult.methodName}`;

      const testItem = testMap.get(fullTestName);
      if (testItem) {
        const outcomeStr = testResult.outcome.toString();
        if (outcomeStr === PASS_RESULT) {
          run.passed(testItem, testResult.runTime);
        } else if (outcomeStr === FAIL_RESULT) {
          const message = new vscode.TestMessage(testResult.message ?? testResult.stackTrace ?? 'Test failed');
          if (testResult.stackTrace) {
            message.location = this.parseStackTrace(testResult.stackTrace);
          }
          run.failed(testItem, message, testResult.runTime);
        } else if (outcomeStr === SKIP_RESULT) {
          run.skipped(testItem);
        }
        updatedItems.add(testItem);
      } else {
        // Test result doesn't match any known test item
        // This can happen if the test was run as part of a suite but isn't in our tree
        console.debug(`Test result for ${fullTestName} doesn't match any test item. Available items: ${testMap.size}`);
      }
    }
  }

  private parseStackTrace(stackTrace: string): vscode.Location | undefined {
    // Try to parse line number from stack trace
    const lineMatch = stackTrace.match(/line (\d+)/);
    if (lineMatch) {
      const lineNumber = parseInt(lineMatch[1], 10) - 1; // Convert to 0-based
      // Try to find the file from the stack trace
      const fileMatch = stackTrace.match(/Class\.([^.]+)\./);
      if (fileMatch) {
        const className = fileMatch[1];
        const classItem = Array.from(this.classItems.values()).find(item => item.label === className);
        if (classItem) {
          return new vscode.Location(classItem.uri!, new vscode.Range(lineNumber, 0, lineNumber, 0));
        }
      }
    }
    return undefined;
  }

  private async updateTestResults(testResultFilePath: string): Promise<void> {
    try {
      const fs = vscode.workspace.fs;
      const resultData = await fs.readFile(vscode.Uri.file(testResultFilePath));
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const resultContent = JSON.parse(Buffer.from(resultData).toString('utf-8')) as TestResult;

      // Create a test run to update results
      const run = this.controller.createTestRun(new vscode.TestRunRequest());

      for (const test of resultContent.tests) {
        const { name, namespacePrefix } = test.apexClass;
        const apexClassName = namespacePrefix ? `${namespacePrefix}.${name}` : name;
        const methodItem = this.methodItems.get(`${apexClassName}.${test.methodName}`);

        if (methodItem) {
          const outcomeStr = test.outcome.toString();
          if (outcomeStr === PASS_RESULT) {
            run.passed(methodItem, test.runTime);
          } else if (outcomeStr === FAIL_RESULT) {
            const message = new vscode.TestMessage(test.message ?? test.stackTrace ?? 'Test failed');
            if (test.stackTrace) {
              message.location = this.parseStackTrace(test.stackTrace);
            }
            run.failed(methodItem, message, test.runTime);
          } else if (outcomeStr === SKIP_RESULT) {
            run.skipped(methodItem);
          }
        }
      }

      run.end();
    } catch (error) {
      throw new Error(`Failed to update test results: ${String(error)}`);
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

let testControllerInst: ApexTestController;

export const getTestController = (): ApexTestController => {
  if (!testControllerInst) {
    testControllerInst = new ApexTestController();
  }
  return testControllerInst;
};
