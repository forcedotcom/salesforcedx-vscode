/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { CodeCoverageResultSchema, PerClassCoverageSchema } from './coverageSchemas.js';
import { ApexDiagnosticSchema } from './diagnostics.js';
import {
  ApexLogIdString,
  ApexClassIdString,
  ApexTestQueueItemIdString,
  ApexTestResultIdString,
  FlowTestResultIdString,
  OrgIdString,
  TestRunIdString,
  UserIdString
} from './schema/salesforceId.js';

/** Specifies which Apex tests run. */
export const TestLevelSchema = Schema.Literals(['RunLocalTests', 'RunAllTestsInOrg', 'RunSpecifiedTests']).annotate({
  identifier: 'TestLevel'
});

/** Test implementation category. */
export const TestCategorySchema = Schema.Literals(['Apex', 'Flow']);

const ResultFormatSchema = Schema.Literals(['junit', 'tap', 'json', 'human', 'markdown', 'text']).annotate({
  identifier: 'ResultFormat'
});

export const ResultFormatsSchema = ResultFormatSchema.pipe(
  Schema.Array,
  Schema.UndefinedOr,
  Schema.annotate({ identifier: 'ResultFormats' })
);

const ResultFileFormatSchema = Schema.Literals(['junit', 'tap', 'json', 'markdown', 'text']).pipe(
  Schema.annotate({ identifier: 'ResultFileFormat' })
);
export const ResultFileFormatsSchema = Schema.Array(ResultFileFormatSchema).pipe(
  Schema.annotate({ identifier: 'ResultFileFormats' })
);

export const ApexTestResultOutcomeSchema = Schema.Literals(['Pass', 'Fail', 'CompileFail', 'Skip']).pipe(
  Schema.annotate({ identifier: 'ApexTestResultOutcome' })
);

export const ApexTestRunResultStatusSchema = Schema.Literals([
  'Queued',
  'Processing',
  'Aborted',
  'Passed',
  'Failed',
  'Completed',
  'Skipped'
]).pipe(Schema.annotate({ identifier: 'ApexTestRunResultStatus' }));

const ApexTestResultDataFields = {
  /** Salesforce Apex or Flow test result ID; absent for synchronous results. */
  id: Schema.optional(Schema.Union([ApexTestResultIdString, FlowTestResultIdString])),
  /** Queue item for async tests; absent for synchronous results. */
  queueItemId: Schema.optional(ApexTestQueueItemIdString),
  /** The Apex stack trace if the test failed; otherwise, null. */
  stackTrace: Schema.NonEmptyString.pipe(Schema.NullOr, Schema.optional),
  /** The exception error message if a test failure occurs; otherwise, null. */
  message: Schema.NonEmptyString.pipe(Schema.NullOr, Schema.optional),
  /** AsyncApexJob for async Apex runs; absent for synchronous and Flow tests. */
  asyncApexJobId: Schema.optional(TestRunIdString),
  /** The name of the test method. */
  methodName: Schema.String,
  /** The result of the test. */
  outcome: ApexTestResultOutcomeSchema,
  /** Apex log ID, or null when debug logging is disabled; absent for Flow tests. */
  apexLogId: ApexLogIdString.pipe(Schema.NullOr, Schema.optional),
  apexClass: Schema.Struct({
    /** Apex class ID; absent for Flow tests. */
    id: Schema.optional(ApexClassIdString),
    /** Name of the class (up to 255 characters). */
    name: Schema.String,
    /** The namespace prefix associated with this ApexClass; null for the default namespace. */
    namespacePrefix: Schema.NonEmptyString.pipe(Schema.NullOr, Schema.optional),
    /** The full name of the associated ApexClass. */
    fullName: Schema.String
  }),
  /** The time it took the test method to run, in seconds. */
  runTime: Schema.Number,
  /** The start time of the test method. */
  testTimestamp: Schema.optional(Schema.NonEmptyString),
  /** The full name of the associated ApexClass method. */
  fullName: Schema.String,
  /** The associated ApexCodeCoverage object. */
  perClassCoverage: Schema.Array(PerClassCoverageSchema).pipe(Schema.mutable, Schema.optional),
  diagnostic: Schema.optional(ApexDiagnosticSchema),
  /** The category of the test (Apex or Flow). */
  category: Schema.optional(TestCategorySchema)
};

export const ApexTestResultDataSchema = Schema.Struct(ApexTestResultDataFields).annotate({
  identifier: 'ApexTestResultData'
});

export const ApexTestResultDataRawSchema = Schema.Struct({
  ...ApexTestResultDataFields,
  /** Indicates if the results are for a test setup method. The default is false. */
  isTestSetup: Schema.optional(Schema.Boolean)
}).annotate({ identifier: 'ApexTestResultDataRaw' });

export const ApexTestSetupDataSchema = Schema.Struct({
  id: Schema.optional(Schema.Union([ApexTestResultIdString, FlowTestResultIdString])),
  stackTrace: Schema.optional(Schema.NonEmptyString),
  message: Schema.optional(Schema.NonEmptyString),
  asyncApexJobId: Schema.optional(TestRunIdString),
  methodName: Schema.String,
  apexLogId: Schema.optional(ApexLogIdString),
  apexClass: Schema.Struct({
    id: Schema.optional(ApexClassIdString),
    name: Schema.String,
    namespacePrefix: Schema.optional(Schema.NonEmptyString),
    fullName: Schema.String
  }),
  testSetupTime: Schema.Number,
  testTimestamp: Schema.optional(Schema.NonEmptyString),
  fullName: Schema.String,
  diagnostic: Schema.optional(ApexDiagnosticSchema)
}).annotate({ identifier: 'ApexTestSetupData' });

export const TestResultSummarySchema = Schema.Struct({
  failRate: Schema.String,
  testsRan: Schema.Number,
  orgId: OrgIdString,
  outcome: ApexTestRunResultStatusSchema,
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
  username: Schema.optional(Schema.NonEmptyString),
  /** Absent for synchronous test results. */
  testRunId: Schema.optional(TestRunIdString),
  userId: Schema.optional(UserIdString),
  testRunCoverage: Schema.optional(Schema.String),
  orgWideCoverage: Schema.optional(Schema.String),
  totalLines: Schema.optional(Schema.Number),
  coveredLines: Schema.optional(Schema.Number)
});

/** Formatted Apex test results written by the test service. */
export const TestResultSchema = Schema.Struct({
  summary: TestResultSummarySchema,
  tests: Schema.Array(ApexTestResultDataSchema).pipe(Schema.mutable),
  setup: Schema.Array(ApexTestSetupDataSchema).pipe(Schema.mutable, Schema.optional),
  codecoverage: Schema.Array(CodeCoverageResultSchema).pipe(Schema.mutable, Schema.optional)
}).annotate({ identifier: 'TestResult' });

export const TestResultRawSchema = Schema.Struct({
  summary: TestResultSummarySchema,
  tests: Schema.Array(ApexTestResultDataRawSchema).pipe(Schema.mutable),
  codecoverage: Schema.Array(CodeCoverageResultSchema).pipe(Schema.mutable, Schema.optional)
}).annotate({ identifier: 'TestResultRaw' });
