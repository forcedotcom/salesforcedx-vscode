/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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
import { buildTestPayload } from '../utils/payloadBuilder';
import {
  createClassId,
  createMethodId,
  createSuiteClassId,
  createSuiteId,
  extractSuiteName,
  getTestName,
  isClass,
  isMethod,
  isSuite,
  gatherTests
} from '../utils/testItemUtils';
import { updateTestRunResults } from '../utils/testResultProcessor';
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
  private suiteToClasses: Map<string, Set<string>> = new Map();

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
    this.suiteToClasses.clear();
  }

  private populateTestItems(tests: ApexTestMethod[]): void {
    const classMap = new Map<string, { tests: ApexTestMethod[]; uri: vscode.Uri }>();

    // Group tests by class
    for (const test of tests) {
      const className = test.definingType;
      if (!classMap.has(className)) {
        classMap.set(className, { tests: [], uri: test.location.uri });
      }
      const classData = classMap.get(className);
      if (classData) {
        classData.tests.push(test);
      }
    }

    // Create test items for classes and methods
    for (const [className, classData] of classMap) {
      const classItem = this.controller.createTestItem(createClassId(className), className, classData.uri);
      classItem.canResolveChildren = false;
      this.classItems.set(className, classItem);

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
        this.methodItems.set(methodId, methodItem);
        classItem.children.add(methodItem);
      }

      this.controller.items.add(classItem);
      this.testItems.set(createClassId(className), classItem);
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

      // Add all suites as children of the parent
      for (const suite of suites) {
        const suiteId = createSuiteId(suite.TestSuiteName);
        const suiteItem = this.controller.createTestItem(suiteId, suite.TestSuiteName, undefined);
        suiteItem.canResolveChildren = true;
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
    const testsToRun = gatherTests(request, this.controller.items, this.suiteItems);

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
    // Group tests by type (class vs method)
    for (const test of testsToRun) {
      try {
        if (isMethod(test.id)) {
          // Debug single method
          const testName = getTestName(test);
          await vscode.commands.executeCommand('sf.test.view.debugSingleTest', { name: testName });
        } else if (isClass(test.id)) {
          // Debug class (all methods in class)
          const className = getTestName(test);
          await vscode.commands.executeCommand('sf.test.view.debugTests', { name: className });
        } else if (isSuite(test.id)) {
          // Suites cannot be debugged - only individual classes or methods can be debugged
          run.errored(test, new vscode.TestMessage(nls.localize('apex_test_suite_debug_not_supported_message')));
        }
      } catch (error) {
        run.errored(test, new vscode.TestMessage(nls.localize('apex_test_debug_failed_message', String(error))));
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

let testControllerInst: ApexTestController;

export const getTestController = (): ApexTestController => {
  if (!testControllerInst) {
    testControllerInst = new ApexTestController();
  }
  return testControllerInst;
};
