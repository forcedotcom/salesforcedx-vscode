/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// NOTE: half of these values are declared by loglevel enum
export const enum TestLogLevel {
  trace = 'trace',
  debug = 'debug',
  info = 'info',
  warn = 'warn',
  error = 'error',
  fatal = 'fatal',
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export const enum TestLevel {
  /**
   * All tests in your org are run, except the ones that originate from installed managed packages
   */
  RunLocalTests = 'RunLocalTests',
  /**
   * All tests are in your org and in installed managed packages are run
   */
  RunAllTestsInOrg = 'RunAllTestsInOrg',
  /**
   * Only the tests that you specify are run
   */
  RunSpecifiedTests = 'RunSpecifiedTests'
}

export type AsyncTestConfiguration = {
  /**
   * Comma-separated list of class names
   */
  classNames?: string;
  /**
   * Comma-separated list of class IDs
   */
  classids?: string;
  /**
   * Comma-separated list of test suite names
   */
  suiteNames?: string;
  /**
   * Comma-separated list of test suite IDs
   */
  suiteids?: string;
  /**
   * Limits the test run from executing new tests after a given number of tests fail.
   * Valid value ranges from 0 to 1,000,000. A value of 0 causes the test run to stop if any failure occurs.
   */
  maxFailedTests?: number;
  /**
   * Specifies which tests to run, default level is RunSpecifiedTests
   */
  testLevel: TestLevel;
  skipCodeCoverage?: boolean;
};

/**
 * array of objects that represent Apex test classes
 */
export type TestItem = {
  /**
   * Apex Class name. Should include namespace if needed e.g. namespace.ClassName
   */
  className?: string;
  /**
   * Apex Class Id
   */
  classId?: string;
  /**
   * Array of test names to run. Not specifying it will run all test methods in a test class
   */
  testMethods?: string[];
};

export type AsyncTestArrayConfiguration = {
  tests: [TestItem];
  /**
   * Limits the test run from executing new tests after a given number of tests fail.
   * Valid value ranges from 0 to 1,000,000. A value of 0 causes the test run to stop if any failure occurs.
   */
  maxFailedTests?: number;

  /**
   * Specifies which tests to run, default level is RunSpecifiedTests
   */
  testLevel: TestLevel;
};

export type SyncTestConfiguration = {
  tests: [TestItem];
  /**
   * Specifies which tests to run. The only valid value is RunSpecifiedTests.
   */
  testLevel?: string;
  /**
   * Limits the test run from executing new tests after a given number of tests fail.
   * Valid value ranges from 0 to 1,000,000. A value of 0 causes the test run to stop if any failure occurs.
   */
  maxFailedTests?: number;
};

export type SyncTestSuccess = {
  id: string;
  methodName: string;
  name: string;
  namespace: string | null;
  seeAllData: boolean;
  time: number;
};

export type SyncTestFailure = {
  id: string;
  message: string;
  methodName: string;
  name: string;
  namespace: string | null;
  seeAllData: boolean;
  stackTrace: string;
  time: number;
  type: string; // might change it to an enum
};

export type SyncTestResult = {
  apexLogId: string;
  failures: SyncTestFailure[];
  numFailures: number;
  numTestsRun: number;
  successes: SyncTestSuccess[];
  totalTime: number;
};

export type SyncTestErrorResult = {
  message: string;
  errorCode: string; // might change it to an enum
};

export const enum ApexTestResultOutcome {
  Pass = 'Pass',
  Fail = 'Fail',
  CompileFail = 'CompileFail',
  Skip = 'Skip'
}

export type ApexTestResultRecord = {
  Id: string;
  /**
   * Points to the ApexTestQueueItem which is the class that this test method is part of
   */
  QueueItemId: string;
  /**
   * The Apex stack trace if the test failed; otherwise, null.
   */
  StackTrace: string | null;
  /**
   * The exception error message if a test failure occurs; otherwise, null.
   */
  Message: string | null;
  /**
   * Points to the AsyncApexJob that represents the entire test run
   */
  AsyncApexJobId: string;
  /**
   * The name of the test method.
   */
  MethodName: string;
  /**
   * The result of the test
   */
  Outcome: ApexTestResultOutcome;
  /**
   * Points to the ApexLog for this test method execution if debug logging is enabled; otherwise, null.
   */
  ApexLogId: string | null;
  ApexClass: {
    Id: string;
    /**
     * Name of the class (up to 255 characters)
     */
    Name: string;
    /**
     * The namespace prefix associated with this ApexClass
     */
    NamespacePrefix: string;
    /**
     * The full name of the associated ApexClass
     */
    FullName: string;
  };
  /**
   * The time it took the test method to run, in seconds.
   */
  RunTime: number;
  /**
   * The start time of the test method.
   */
  TestTimestamp: number;
  /**
   * The full name of the associated ApexClass method
   */
  FullName?: string;
};

export type ApexTestResult = {
  done: boolean;
  totalSize: number;
  records: ApexTestResultRecord[];
};

export const enum ApexTestRunResultStatus {
  Queued = 'Queued',
  Processing = 'Processing',
  Aborted = 'Aborted',
  Completed = 'Completed',
  Failed = 'Failed'
}

export type ApexTestRunResultRecord = {
  /**
   * The parent Apex job ID for the result
   */
  AsyncApexJobId: string;
  /**
   * The status of the test run
   */
  Status: ApexTestRunResultStatus;
  /**
   * The time at which the test run started.
   */
  StartTime: string;
  /**
   * The time it took the test to run, in seconds.
   */
  TestTime: number;
  /**
   * The user who ran the test run
   */
  UserId: string;
};

export type ApexTestRunResult = {
  done: boolean;
  totalSize: number;
  records: ApexTestRunResultRecord[];
};

export const enum ApexTestQueueItemStatus {
  Holding = 'Holding',
  Queued = 'Queued',
  Preparing = 'Preparing',
  Processing = 'Processing',
  Aborted = 'Aborted',
  Completed = 'Completed',
  Failed = 'Failed'
}

export type ApexTestQueueItemRecord = {
  Id: string;
  /**
   * The status of the job
   */
  Status: ApexTestQueueItemStatus;
  ApexClassId: string;
  /**
   * The ID of the associated ApexTestRunResult object
   */
  TestRunResultId: string;
};

export type ApexTestQueueItem = {
  done: boolean;
  totalSize: number;
  records: ApexTestQueueItemRecord[];
};

export type AsyncTestResult = {
  summary: {
    outcome: string;
    testStartTime: string;
    testExecutionTime: number;
    testRunId: string;
    userId: string;
  };
  tests: ApexTestResultRecord[];
  codecoverage?: [];
};
