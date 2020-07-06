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

export enum TestLevel {
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
   * comma-separated list of class names
   */
  classNames?: string;
  /**
   * comma-separated list of class IDs
   */
  classids?: string;
  /**
   * comma-separated list of test suite names
   */
  suiteNames?: string;
  /**
   * comma-separated list of test suite IDs
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
  tests: [
    TestItem[],
    {
      /**
       * Limits the test run from executing new tests after a given number of tests fail.
       * Valid value ranges from 0 to 1,000,000. A value of 0 causes the test run to stop if any failure occurs.
       */
      maxFailedTests?: number;
    },
    {
      /**
       * Specifies which tests to run, default level is RunSpecifiedTests
       */
      testLevel: TestLevel;
    }
  ];
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
