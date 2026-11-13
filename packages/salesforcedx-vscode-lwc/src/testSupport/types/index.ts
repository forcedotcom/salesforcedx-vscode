/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Schema from 'effect/Schema';
import { type Location } from 'vscode';
import { type URI } from 'vscode-uri';

/**
 * Test result statuses are presented with
 * different colors in the test explorer.
 */
export type TestResultStatus = 'passed' | 'failed' | 'skipped' | 'unknown';

export type TestRunType = 'run' | 'debug' | 'watch';

/**
 * Test Result type contains the test result status.
 * For now, failure messages are stored in DiagnosticCollection instead of here.
 */
type TestResult = {
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
export type LwcJestTestResults = typeof LwcJestTestResultsSchema.Type;

/**
 * Jest Test Assertion Result status.
 * - 'passed' transforms to TestResultStatus.PASSED
 * - 'failed' transforms to TestResultStatus.FAILED
 * - All other statuses tranform to TestResultStatus.SKIPPED
 */
const LwcJestTestResultStatusSchema = Schema.Literal('passed', 'failed', 'pending', 'skipped', 'todo', 'disabled');

/** Jest Test File Result */
export type LwcJestTestFileResult = typeof LwcJestTestFileResultSchema.Type;

/**
 * Jest Test Assertion Result
 */
const LwcJestTestAssertionResultSchema = Schema.Struct({
  status: LwcJestTestResultStatusSchema,
  title: Schema.String,
  ancestorTitles: Schema.Array(Schema.String).pipe(Schema.mutable),
  failureMessages: Schema.Array(Schema.String).pipe(Schema.mutable, Schema.NullOr),
  fullName: Schema.String,
  location: Schema.Struct({ column: Schema.Number, line: Schema.Number }).pipe(Schema.NullOr, Schema.optional),
  duration: Schema.optionalWith(Schema.Number, { nullable: true })
});
export type LwcJestTestAssertionResult = typeof LwcJestTestAssertionResultSchema.Type;

const LwcJestTestFileResultSchema = Schema.Struct({
  status: Schema.Literal('passed', 'failed', 'focused', 'skipped'),
  startTime: Schema.Number,
  endTime: Schema.Number,
  name: Schema.String,
  assertionResults: Schema.Array(LwcJestTestAssertionResultSchema).pipe(Schema.mutable),
  // Runtime error message when test suite fails to run before assertions can be collected
  message: Schema.optional(Schema.String)
});

export const LwcJestTestResultsSchema = Schema.Struct({
  numFailedTestSuites: Schema.Number,
  numFailedTests: Schema.Number,
  numPassedTestSuites: Schema.Number,
  numPassedTests: Schema.Number,
  numPendingTestSuites: Schema.Number,
  numPendingTests: Schema.Number,
  numRuntimeErrorTestSuites: Schema.Number,
  numTotalTestSuites: Schema.Number,
  numTotalTests: Schema.Number,
  testResults: Schema.Array(LwcJestTestFileResultSchema).pipe(Schema.mutable)
});
