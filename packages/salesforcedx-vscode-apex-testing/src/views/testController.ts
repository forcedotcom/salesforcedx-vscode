/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ResultFormat, TestLevel, TestResult, TestService } from '@salesforce/apex-node';
import { getTestResultsFolder } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { FAIL_RESULT, PASS_RESULT, SKIP_RESULT } from '../constants';
import { getVscodeCoreExtension } from '../coreExtensionUtils';
import { nls } from '../messages';
import * as settings from '../settings';
import { telemetryService } from '../telemetry/telemetry';
import { getApexTests, getLanguageClientStatus } from '../utils/testUtils';
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
  private resultFileWatcher: vscode.FileSystemWatcher | undefined;
  private lastProcessedResultFile: string | null = null;

  constructor() {
    this.controller = vscode.tests.createTestController(TEST_CONTROLLER_ID, nls.localize('test_view_name'));
    this.setupRunProfiles();
    this.setupRefreshHandler();
  }

  public getController(): vscode.TestController {
    return this.controller;
  }

  public async refresh(): Promise<void> {
    this.clearTestItems();
    await this.discoverTests();
  }

  public async discoverTests(): Promise<void> {
    const config = vscode.workspace.getConfiguration('salesforcedx-vscode-apex');
    const source = config.get<'ls' | 'api'>('testing.discoverySource', 'ls');

    if (source === 'ls') {
      const languageClientStatus = await getLanguageClientStatus();
      if (!languageClientStatus.isReady()) {
        if (languageClientStatus.failedToInitialize()) {
          void vscode.window.showInformationMessage(languageClientStatus.getStatusMessage());
        }
        return;
      }
    }

    try {
      const tests = await getApexTests();
      this.populateTestItems(tests);
      await this.populateSuiteItems();
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
      const classItem = this.controller.createTestItem(
        `class:${className}`,
        className,
        classData.uri
      );
      classItem.canResolveChildren = false;
      this.classItems.set(className, classItem);

      for (const test of classData.tests) {
        const methodName = test.methodName;
        const methodId = `${className}.${methodName}`;
        const methodItem = this.controller.createTestItem(
          `method:${methodId}`,
          methodName,
          test.location.uri
        );
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
      const vscodeCoreExtension = await getVscodeCoreExtension();
      const connection = await vscodeCoreExtension.exports.WorkspaceContext.getInstance().getConnection();
      const testService = new TestService(connection);
      const suites = await testService.retrieveAllSuites();

      for (const suite of suites) {
        const suiteItem = this.controller.createTestItem(
          `suite:${suite.TestSuiteName}`,
          suite.TestSuiteName,
          undefined
        );
        suiteItem.canResolveChildren = true;
        this.suiteItems.set(suite.TestSuiteName, suiteItem);

        // Note: Test suites may need to be resolved lazily
        // For now, we'll add them to the tree and resolve children when expanded
        this.controller.items.add(suiteItem);
        this.testItems.set(`suite:${suite.TestSuiteName}`, suiteItem);
      }
    } catch (error) {
      console.debug('Failed to populate suite items:', error);
    }
  }

  private setupRunProfiles(): void {
    // Run profile
    this.controller.createRunProfile(
      nls.localize('run_tests_title'),
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTests(request, token, false)
    );

    // Debug profile
    this.controller.createRunProfile(
      'Debug Tests',
      vscode.TestRunProfileKind.Debug,
      (request, token) => this.runTests(request, token, true)
    );
  }

  private setupRefreshHandler(): void {
    this.controller.refreshHandler = async () => {
      await this.refresh();
    };
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
        const testNames = testsToRun.map(test => this.getTestName(test));
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
      console.debug('Test run failed:', error);
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
          // For suites, we need to debug all classes in the suite
          const children: vscode.TestItem[] = [];
          test.children.forEach(child => children.push(child));
          for (const classItem of children) {
            if (classItem.id.startsWith('class:')) {
              const className = classItem.id.replace('class:', '');
              await vscode.commands.executeCommand('sf.test.view.debugTests', { name: className });
            }
          }
        }
      } catch (error) {
        run.errored(test, new vscode.TestMessage(`Debug failed: ${String(error)}`));
      }
    }
  }

  private gatherTests(request: vscode.TestRunRequest): vscode.TestItem[] {
    const tests: vscode.TestItem[] = [];

    const include = (test: vscode.TestItem): void => {
      if (test.children.size > 0) {
        test.children.forEach(child => include(child));
      } else {
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
    testsToRun: vscode.TestItem[]
  ): Promise<void> {
    const vscodeCoreExtension = await getVscodeCoreExtension();
    const connection = await vscodeCoreExtension.exports.WorkspaceContext.getInstance().getConnection();
    const testService = new TestService(connection);

    // Check if we're running a suite
    const suiteNames = testNames.filter(name => this.suiteItems.has(name));
    const nonSuiteNames = testNames.filter(name => !this.suiteItems.has(name));

    let payload;
    if (suiteNames.length > 0 && nonSuiteNames.length === 0) {
      // Running a suite - use the suite name
      payload = await testService.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        suiteNames.join(','),
        undefined,
        undefined,
        undefined,
        !codeCoverage
      );
    } else {
      // Running individual tests or classes
      payload = await testService.buildAsyncPayload(
        TestLevel.RunSpecifiedTests,
        nonSuiteNames.join(','),
        undefined,
        undefined,
        undefined,
        !codeCoverage
      );
    }

    // TODO: fix in apex-node W-18453221
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = (await testService.runTestAsynchronous(
      payload,
      codeCoverage,
      false,
      {
        report: () => {
          // Progress reporting can be added here
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

    // Update test results
    this.updateTestRunResults(result, run, testsToRun);
  }

  private updateTestRunResults(
    result: TestResult,
    run: vscode.TestRun,
    testsToRun: vscode.TestItem[]
  ): void {
    const testMap = new Map<string, vscode.TestItem>();

    // Build a map of test names to test items
    for (const test of testsToRun) {
      const testName = this.getTestName(test);
      testMap.set(testName, test);
    }

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
          const message = new vscode.TestMessage(
            testResult.message ?? testResult.stackTrace ?? 'Test failed'
          );
          if (testResult.stackTrace) {
            message.location = this.parseStackTrace(testResult.stackTrace);
          }
          run.failed(testItem, message, testResult.runTime);
        } else if (outcomeStr === SKIP_RESULT) {
          run.skipped(testItem);
        }
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
          return new vscode.Location(
            classItem.uri!,
            new vscode.Range(lineNumber, 0, lineNumber, 0)
          );
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
      console.debug('Failed to update test results:', error);
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
