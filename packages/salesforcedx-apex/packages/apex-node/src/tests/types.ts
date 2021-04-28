/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ApexDiagnostic } from '../utils/types';

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

export enum ResultFormat {
  junit = 'junit',
  tap = 'tap',
  json = 'json',
  human = 'human'
}

export type OutputDirConfig = {
  dirPath: string;
  resultFormats?: ResultFormat[];
  fileInfos?: { filename: string; content: string | object }[];
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
  /**
   * Namespace associated with the test class or method
   */
  namespace?: string;
};

export type AsyncTestArrayConfiguration = {
  tests: TestItem[];
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
  classNames?: string;
  /**
   * Specifies which test class to run. Only one class is allowed for synchronous runs.
   */
  tests?: TestItem[];
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

export type ApiSyncTestResult = {
  done: boolean;
  totalSize: number;
  records: SyncTestResult[];
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
  TestTimestamp: string;
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
  Passed = 'Passed',
  Failed = 'Failed',
  Completed = 'Completed',
  Skipped = 'Skipped'
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

export type ApexTestResultData = {
  id: string;
  /**
   * Points to the ApexTestQueueItem which is the class that this test method is part of
   */
  queueItemId: string;
  /**
   * The Apex stack trace if the test failed; otherwise, null.
   */
  stackTrace: string | null;
  /**
   * The exception error message if a test failure occurs; otherwise, null.
   */
  message: string | null;
  /**
   * Points to the AsyncApexJob that represents the entire test run
   */
  asyncApexJobId: string;
  /**
   * The name of the test method.
   */
  methodName: string;
  /**
   * The result of the test
   */
  outcome: ApexTestResultOutcome;
  /**
   * Points to the ApexLog for this test method execution if debug logging is enabled; otherwise, null.
   */
  apexLogId: string | null;
  apexClass: {
    id: string;
    /**
     * Name of the class (up to 255 characters)
     */
    name: string;
    /**
     * The namespace prefix associated with this ApexClass
     */
    namespacePrefix: string;
    /**
     * The full name of the associated ApexClass
     */
    fullName: string;
  };
  /**
   * The time it took the test method to run, in seconds.
   */
  runTime: number;
  /**
   * The start time of the test method.
   */
  testTimestamp: string;
  /**
   * The full name of the associated ApexClass method
   */
  fullName: string;
  /**
   * The associated ApexCodeCoverage object
   */
  perClassCoverage?: PerClassCoverage[];
  diagnostic?: ApexDiagnostic;
};

export type CodeCoverageResult = {
  apexId: string;
  name: string;
  type: 'ApexClass' | 'ApexTrigger';
  numLinesCovered: number;
  numLinesUncovered: number;
  percentage: string;
  coveredLines: number[];
  uncoveredLines: number[];
};

export type TestResult = {
  summary: {
    failRate: string;
    testsRan: number;
    orgId: string;
    outcome: string;
    passing: number;
    failing: number;
    skipped: number;
    passRate: string;
    skipRate: string;
    testStartTime: string;
    testExecutionTimeInMs: number;
    testTotalTimeInMs: number;
    commandTimeInMs: number;
    hostname: string;
    username: string;
    testRunId: string;
    userId: string;
    testRunCoverage?: string;
    orgWideCoverage?: string;
    totalLines?: number;
    coveredLines?: number;
  };
  tests: ApexTestResultData[];
  codecoverage?: CodeCoverageResult[];
};

export type ApexCodeCoverageRecord = {
  ApexClassOrTrigger: {
    Id: string;
    Name: string;
  };
  ApexTestClassId: string;
  TestMethodName: string;
  NumLinesCovered: number;
  NumLinesUncovered: number;
  Coverage?: {
    coveredLines: number[];
    uncoveredLines: number[];
  };
};

export type ApexCodeCoverage = {
  done: boolean;
  totalSize: number;
  records: ApexCodeCoverageRecord[];
};

export type PerClassCoverage = {
  apexClassOrTriggerName: string;
  apexClassOrTriggerId: string;
  apexTestClassId: string;
  apexTestMethodName: string;
  numLinesCovered: number;
  numLinesUncovered: number;
  percentage: string;
  coverage?: { coveredLines: number[]; uncoveredLines: number[] };
};

export type ApexCodeCoverageAggregateRecord = {
  ApexClassOrTrigger: {
    Id: string;
    Name: string;
  };
  NumLinesCovered: number;
  NumLinesUncovered: number;
  Coverage: {
    coveredLines: number[];
    uncoveredLines: number[];
  };
};

export type ApexCodeCoverageAggregate = {
  done: boolean;
  totalSize: number;
  records: ApexCodeCoverageAggregateRecord[];
};

export type ApexOrgWideCoverage = {
  done: boolean;
  totalSize: number;
  records: { PercentCovered: string }[];
};

export type NamespaceRecord = {
  NamespacePrefix: string;
};

export type NamespaceQueryResult = {
  records: NamespaceRecord[];
};

export type NamespaceInfo = {
  installedNs: boolean;
  namespace: string;
};

export type ApexTestProgressValue =
  | {
      type: 'StreamingClientProgress';
      value: 'streamingTransportUp' | 'streamingTransportDown';
      message: string;
    }
  | {
      type: 'StreamingClientProgress';
      value: 'streamingProcessingTestRun';
      testRunId: string;
      message: string;
    }
  | {
      type: 'TestQueueProgress';
      value: ApexTestQueueItem;
    }
  | {
      type: 'FormatTestResultProgress';
      value: 'retrievingTestRunSummary' | 'queryingForAggregateCodeCoverage';
      message: string;
    }
  | {
      type: 'AbortTestRunProgress';
      value: 'abortingTestRun' | 'abortingTestRunRequested';
      message: string;
      testRunId: string;
    };

export type TestSuiteMembershipRecord = { ApexClassId: string };
