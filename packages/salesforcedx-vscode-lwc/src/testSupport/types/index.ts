/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Location } from 'vscode';
import { URI } from 'vscode-uri';

/**
 * Test result statuses are presented with
 * different colors in the test explorer.
 */
export type TestResultStatus = 'passed' | 'failed' | 'skipped' | 'unknown';

/**
 * Test Result type contains the test result status.
 * For now, failure messages are stored in DiagnosticCollection instead of here.
 */
export type TestResult = {
  status: TestResultStatus;
};


/**
 * Confirms if the TestExecutionInfo kind is TestCaseInfo
 */
export const isTestCaseInfo = (testExecutionInfo: TestExecutionInfo): testExecutionInfo is TestCaseInfo =>
  testExecutionInfo.kind === 'testCase';

/**
 * Raw Test Results generated from Jest output.
 * The title and ancestorTitles will be used to match and merge with the existing test cases
 * created by test file parser.
 */
export type RawTestResult = {
  title: string;
  ancestorTitles?: string[];
  status: TestResultStatus;
};

/**
 * Test File Information.
 * It contains the test's URI, location (The beginning of the documentation by default),
 * test results and associated test cases information.
 */
export type TestFileInfo = {
  kind: 'testFile';
  testUri: URI;
  testLocation?: Location;
  testResult?: TestResult;
  testCasesInfo?: TestCaseInfo[];
  rawTestResults?: RawTestResult[];
};

/**
 * Test Case Information.
 * It contains the test case's URI, location, and
 * test name and ancestor titles, which are used for matching with test results.
 */
export type TestCaseInfo = {
  kind: 'testCase';
  testUri: URI;
  testLocation?: Location;
  testResult?: TestResult;
  testName: string;
  ancestorTitles?: string[];
};

/**
 * Test Directory Information.
 * It contains the test directory Uri.
 */
export type TestDirectoryInfo = {
  kind: 'testDirectory';
  testUri: URI;
  testResult?: TestResult;
};

/**
 * Test Execution Information.
 */
export type TestExecutionInfo = TestCaseInfo | TestFileInfo | TestDirectoryInfo;

// Jest Specific definitions
/**
 * Top level Jest output JSON object shape
 */
export type LwcJestTestResults = {
  numFailedTestSuites: number;
  numFailedTests: number;
  numPassedTestSuites: number;
  numPassedTests: number;
  numPendingTestSuites: number;
  numPendingTests: number;
  numRuntimeErrorTestSuites: number;
  numTotalTestSuites: number;
  numTotalTests: number;
  testResults: LwcJestTestFileResult[];
};

/**
 * Jest Test Assertion Result status.
 * - 'passed' transforms to TestResultStatus.PASSED
 * - 'failed' transforms to TestResultStatus.FAILED
 * - All other statuses tranform to TestResultStatus.SKIPPED
 */
type LwcJestTestResultStatus = 'passed' | 'failed' | 'pending' | 'skipped' | 'todo' | 'disabled';

/**
 * Jest Test File Result
 */
export type LwcJestTestFileResult = {
  status: 'passed' | 'failed';
  startTime: number;
  endTime: number;
  name: string;
  assertionResults: LwcJestTestAssertionResult[];
};

/**
 * Jest Test Assertion Result
 */
export type LwcJestTestAssertionResult = {
  status: LwcJestTestResultStatus;
  title: string;
  ancestorTitles: string[];
  failureMessages: string[];
  fullName: string;
  location: {
    column: number;
    line: number;
  };
  duration?: number;
};
