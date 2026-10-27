/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { CodeCoverageResultSchema, PerClassCoverageSchema } from '../effect/coverageSchemas';
import type { CodeCoverageResult, PerClassCoverage } from '../effect/coverageSchemas';

export type {
  ApexCodeCoverage,
  ApexCodeCoverageAggregate,
  ApexCodeCoverageAggregateRecord,
  ApexCodeCoverageRecord,
  ApexOrgWideCoverage,
  CodeCoverageResult,
  PerClassCoverage
} from '../effect/coverageSchemas';

/**
 * Specifies which Apex tests run.
 *
 * - `RunLocalTests`: all local tests except those from installed managed packages
 * - `RunAllTestsInOrg`: all local and managed-package tests
 * - `RunSpecifiedTests`: only explicitly selected tests
 */
export const TestLevel = Schema.Literal('RunLocalTests', 'RunAllTestsInOrg', 'RunSpecifiedTests').annotations({
  identifier: 'TestLevel'
});
export type TestLevel = typeof TestLevel.Type;

/** Test implementation category. */
export type TestCategory = 'Apex' | 'Flow';

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
  /**
   * Allows for faster tests by skipping code coverage
   */
  skipCodeCoverage?: boolean;
  /**
   * Does not wait for test run to complete and returns the test run id immediately
   */
  exitOnTestRunId?: boolean;
  /**
   * Category for this run, for Flow or Apex
   */

  category?: string[];
};

export const ResultFormat = Schema.Literal('junit', 'tap', 'json', 'human', 'markdown', 'text').annotations({
  identifier: 'ResultFormat'
});
export type ResultFormat = typeof ResultFormat.Type;

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

  category?: string;
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
  /**
   * Does not wait for test run to complete and returns the test run id immediately
   */
  exitOnTestRunId?: boolean;
  /**
   * Allows for faster tests by skipping code coverage
   */
  skipCodeCoverage?: boolean;

  category?: string[];
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
  /**
   * Allows for faster tests by skipping code coverage
   */
  skipCodeCoverage?: boolean;
  /**
   * Category for this run, for Flow or Apex
   */
  category?: string[];
};

type SyncTestSuccess = {
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

const ApexTestResultOutcomeSchema = Schema.Literal('Pass', 'Fail', 'CompileFail', 'Skip');
export type ApexTestResultOutcome = Schema.Schema.Type<typeof ApexTestResultOutcomeSchema>;

type FlowTestResultRecord = {
  Id: string;
  ApexTestQueueItemId: string;
  Result: ApexTestResultOutcome;
  FlowTest: {
    /**
     * Name of the Flow Test Method (up to 255 characters)
     */
    DeveloperName: string;
  };
  FlowDefinition: {
    DeveloperName: string;
    NamespacePrefix: string;
  };

  /**
   * The start time of the test method.
   */
  TestStartDateTime: string;
  TestEndDateTime: string;
};

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
  /**
   * Indicates if the results are for a test setup method. The default is false.
   */
  IsTestSetup?: boolean;
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
  category?: string;
  totalSize: number;
  records: ApexTestResultRecord[];
};

export type FlowTestResult = {
  done: boolean;
  totalSize: number;
  records: FlowTestResultRecord[];
};

export type ApexTestRunResultStatus =
  | 'Queued'
  | 'Processing'
  | 'Aborted'
  | 'Passed'
  | 'Failed'
  | 'Completed'
  | 'Skipped';

export type ApexTestRunResult = {
  /**
   * The parent Apex job ID for the result
   */
  AsyncApexJobId: string;
  /**
   * The number of classes that have completed execution in the test run
   */
  ClassesCompleted: number;
  /**
   * The number of classes that have been enqueued for execution in the test run
   */
  ClassesEnqueued: number;
  /**
   * The time at which the test run ended.
   */
  EndTime: string | undefined;
  /**
   * The number of methods that have been enqueued for execution in the test run
   */
  MethodsEnqueued: number;
  /**
   * The time at which the test run started.
   */
  StartTime: string | undefined;
  /**
   * The status of the test run
   */
  Status: ApexTestRunResultStatus;
  /**
   * The time it took to set up the test, in seconds.
   */
  TestSetupTime: number | undefined;
  /**
   * The time it took the test to run, in seconds.
   */
  TestTime: number | undefined;
  /**
   * The user who ran the test run
   */
  UserId: string;
};

export type ApexTestQueueItemStatus =
  | 'Holding'
  | 'Queued'
  | 'Preparing'
  | 'Processing'
  | 'Aborted'
  | 'Completed'
  | 'Failed';

export type ApexTestQueueItemRecord = {
  Id: string;
  /**
   * The status of the job
   */
  Status: ApexTestQueueItemStatus;
  ApexClassId: string | null;
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

const ApexDiagnosticSchema = Schema.Struct({
  lineNumber: Schema.optional(Schema.Number),
  columnNumber: Schema.optional(Schema.Number),
  exceptionMessage: Schema.String,
  compileProblem: Schema.String,
  exceptionStackTrace: Schema.String,
  className: Schema.optional(Schema.String)
}).pipe(Schema.mutable);

const ApexTestResultDataSchema = Schema.Struct({
  id: Schema.String,
  /** Points to the ApexTestQueueItem which is the class that this test method is part of. */
  queueItemId: Schema.String,
  /** The Apex stack trace if the test failed; otherwise, null. */
  stackTrace: Schema.NullOr(Schema.String),
  /** The exception error message if a test failure occurs; otherwise, null. */
  message: Schema.NullOr(Schema.String),
  /** Points to the AsyncApexJob that represents the entire test run. */
  asyncApexJobId: Schema.String,
  /** The name of the test method. */
  methodName: Schema.String,
  /** The result of the test. */
  outcome: ApexTestResultOutcomeSchema,
  /** Points to the ApexLog for this test method execution if debug logging is enabled; otherwise, null. */
  apexLogId: Schema.NullOr(Schema.String),
  apexClass: Schema.Struct({
    id: Schema.String,
    /** Name of the class (up to 255 characters). */
    name: Schema.String,
    /** The namespace prefix associated with this ApexClass; null for the default namespace. */
    namespacePrefix: Schema.NullOr(Schema.String),
    /** The full name of the associated ApexClass. */
    fullName: Schema.String
  }).pipe(Schema.mutable),
  /** The time it took the test method to run, in seconds. */
  runTime: Schema.Number,
  /** The start time of the test method. */
  testTimestamp: Schema.String,
  /** The full name of the associated ApexClass method. */
  fullName: Schema.String,
  /** The associated ApexCodeCoverage object. */
  perClassCoverage: Schema.Array(PerClassCoverageSchema).pipe(Schema.mutable, Schema.optional),
  diagnostic: Schema.optional(ApexDiagnosticSchema),
  /** The category of the test (Apex or Flow). */
  category: Schema.optional(Schema.String)
}).pipe(Schema.mutable);
export type ApexTestResultData = Schema.Schema.Type<typeof ApexTestResultDataSchema>;

export type ApexTestResultDataRaw = ApexTestResultData & {
  /**
   * Indicates if the results are for a test setup method. The default is false.
   */
  isTestSetup?: boolean;
};

const ApexTestSetupDataSchema = Schema.Struct({
  id: Schema.String,
  stackTrace: Schema.NullOr(Schema.String),
  message: Schema.NullOr(Schema.String),
  asyncApexJobId: Schema.String,
  methodName: Schema.String,
  apexLogId: Schema.NullOr(Schema.String),
  apexClass: Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    namespacePrefix: Schema.NullOr(Schema.String),
    fullName: Schema.String
  }).pipe(Schema.mutable),
  testSetupTime: Schema.Number,
  testTimestamp: Schema.String,
  fullName: Schema.String,
  diagnostic: Schema.optional(ApexDiagnosticSchema)
}).pipe(Schema.mutable);
export type ApexTestSetupData = Schema.Schema.Type<typeof ApexTestSetupDataSchema>;

export type TestRunIdResult = {
  testRunId: string;
};

const TestResultSummarySchema = Schema.Struct({
  failRate: Schema.String,
  testsRan: Schema.Number,
  orgId: Schema.String,
  outcome: Schema.String,
  passing: Schema.Number,
  failing: Schema.Number,
  skipped: Schema.Number,
  passRate: Schema.String,
  skipRate: Schema.String,
  testStartTime: Schema.String,
  testExecutionTimeInMs: Schema.Number,
  testTotalTimeInMs: Schema.Number,
  testSetupTimeInMs: Schema.optional(Schema.Number),
  commandTimeInMs: Schema.Number,
  hostname: Schema.String,
  username: Schema.String,
  testRunId: Schema.String,
  userId: Schema.String,
  testRunCoverage: Schema.optional(Schema.String),
  orgWideCoverage: Schema.optional(Schema.String),
  totalLines: Schema.optional(Schema.Number),
  coveredLines: Schema.optional(Schema.Number)
}).pipe(Schema.mutable);
type TestResultSummary = Schema.Schema.Type<typeof TestResultSummarySchema>;

/** Formatted Apex test results written by the test service. */
export const TestResultSchema = Schema.Struct({
  summary: TestResultSummarySchema,
  tests: Schema.Array(ApexTestResultDataSchema).pipe(Schema.mutable),
  setup: Schema.Array(ApexTestSetupDataSchema).pipe(Schema.mutable, Schema.optional),
  codecoverage: Schema.Array(CodeCoverageResultSchema).pipe(Schema.mutable, Schema.optional)
}).pipe(Schema.mutable, Schema.annotations({ identifier: 'TestResult' }));
export type TestResult = Schema.Schema.Type<typeof TestResultSchema>;

export type TestResultRaw = {
  summary: TestResultSummary;
  tests: ApexTestResultDataRaw[];
  codecoverage?: CodeCoverageResult[];
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
      type: 'PollingClientProgress';
      value: 'pollingProcessingTestRun';
      testRunId: string;
      message: string;
      classesCompleted: number;
      classesEnqueued: number;
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

/** @internal Used by the co-repo Apex Testing extension; not part of the supported npm API. */
export type TestSuiteMembershipRecord = { ApexClassId: string };
