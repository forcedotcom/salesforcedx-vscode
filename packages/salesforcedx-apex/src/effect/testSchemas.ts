/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexDiagnosticSchema } from './diagnostics';

// Keep array mutability compatible with the existing class result types.
const StringArray = Schema.Array(Schema.String).pipe(Schema.mutable);
const NumberArray = Schema.Array(Schema.Number).pipe(Schema.mutable);

export const TestItemSchema = Schema.Struct({
  className: Schema.optional(Schema.String),
  classId: Schema.optional(Schema.String),
  testMethods: Schema.optional(StringArray),
  namespace: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String)
}).annotations({ identifier: 'TestItem' });

export const SyncTestConfigurationSchema = Schema.Struct({
  classNames: Schema.optional(Schema.String),
  tests: TestItemSchema.pipe(Schema.Array, Schema.mutable, Schema.optional),
  testLevel: Schema.optional(Schema.String),
  maxFailedTests: Schema.optional(Schema.Number),
  skipCodeCoverage: Schema.optional(Schema.Boolean),
  category: Schema.optional(StringArray)
}).annotations({ identifier: 'SyncTestConfiguration' });
export type SyncTestConfiguration = typeof SyncTestConfigurationSchema.Type;

const SyncTestMethodFields = {
  id: Schema.String,
  methodName: Schema.String,
  name: Schema.String,
  namespace: Schema.NullOr(Schema.String),
  seeAllData: Schema.Boolean,
  time: Schema.optionalWith(Schema.Number, { nullable: true, default: () => 0 })
};
const SyncTestSuccessSchema = Schema.Struct(SyncTestMethodFields);
const SyncTestFailureSchema = Schema.Struct({
  ...SyncTestMethodFields,
  message: Schema.optionalWith(Schema.String, { nullable: true, default: () => '' }),
  stackTrace: Schema.optionalWith(Schema.String, { nullable: true, default: () => '' }),
  type: Schema.String
});

/** Known fields from the Tooling runTestsSynchronous response. */
export const SyncTestResultSchema = Schema.Struct({
  apexLogId: Schema.NullOr(Schema.String),
  failures: Schema.Array(SyncTestFailureSchema),
  numFailures: Schema.Number,
  numTestsRun: Schema.Number,
  successes: Schema.Array(SyncTestSuccessSchema),
  totalTime: Schema.optionalWith(Schema.Number, { nullable: true, default: () => 0 })
}).annotations({ identifier: 'SyncTestResult' });

export const CoverageLinesSchema = Schema.Struct({
  coveredLines: NumberArray,
  uncoveredLines: NumberArray
});

export const PerClassCoverageSchema = Schema.Struct({
  apexClassOrTriggerName: Schema.String,
  apexClassOrTriggerId: Schema.String,
  apexTestClassId: Schema.String,
  apexTestMethodName: Schema.String,
  numLinesCovered: Schema.Number,
  numLinesUncovered: Schema.Number,
  percentage: Schema.String,
  coverage: Schema.optional(CoverageLinesSchema)
}).annotations({ identifier: 'PerClassCoverage' });

export const ApexTestResultOutcomeSchema = Schema.Literal('Pass', 'Fail', 'CompileFail', 'Skip').annotations({
  identifier: 'ApexTestResultOutcome'
});

const ApexClassSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  namespacePrefix: Schema.String,
  fullName: Schema.String
});

export const ApexTestResultDataSchema = Schema.Struct({
  id: Schema.String,
  queueItemId: Schema.String,
  stackTrace: Schema.NullOr(Schema.String),
  message: Schema.NullOr(Schema.String),
  asyncApexJobId: Schema.String,
  methodName: Schema.String,
  outcome: ApexTestResultOutcomeSchema,
  apexLogId: Schema.NullOr(Schema.String),
  apexClass: ApexClassSchema,
  runTime: Schema.Number,
  testTimestamp: Schema.String,
  fullName: Schema.String,
  perClassCoverage: PerClassCoverageSchema.pipe(Schema.Array, Schema.mutable, Schema.optional),
  diagnostic: Schema.optional(ApexDiagnosticSchema),
  category: Schema.optional(Schema.String)
}).annotations({ identifier: 'ApexTestResultData' });

export const ApexTestResultDataRawSchema = Schema.Struct({
  ...ApexTestResultDataSchema.fields,
  isTestSetup: Schema.optional(Schema.Boolean)
}).annotations({ identifier: 'ApexTestResultDataRaw' });

export const ApexTestSetupDataSchema = Schema.Struct({
  id: Schema.String,
  stackTrace: Schema.NullOr(Schema.String),
  message: Schema.NullOr(Schema.String),
  asyncApexJobId: Schema.String,
  methodName: Schema.String,
  apexLogId: Schema.NullOr(Schema.String),
  apexClass: ApexClassSchema,
  testSetupTime: Schema.Number,
  testTimestamp: Schema.String,
  fullName: Schema.String,
  diagnostic: Schema.optional(ApexDiagnosticSchema)
}).annotations({ identifier: 'ApexTestSetupData' });

export const CodeCoverageResultSchema = Schema.Struct({
  apexId: Schema.String,
  name: Schema.String,
  type: Schema.Literal('ApexClass', 'ApexTrigger'),
  numLinesCovered: Schema.Number,
  numLinesUncovered: Schema.Number,
  percentage: Schema.String,
  coveredLines: NumberArray,
  uncoveredLines: NumberArray
}).annotations({ identifier: 'CodeCoverageResult' });

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
});

export const TestResultRawSchema = Schema.Struct({
  summary: TestResultSummarySchema,
  tests: ApexTestResultDataRawSchema.pipe(Schema.Array, Schema.mutable),
  codecoverage: CodeCoverageResultSchema.pipe(Schema.Array, Schema.mutable, Schema.optional)
}).annotations({ identifier: 'TestResultRaw' });
export type TestResultRaw = typeof TestResultRawSchema.Type;

export const TestResultSchema = Schema.Struct({
  summary: TestResultSummarySchema,
  tests: ApexTestResultDataSchema.pipe(Schema.Array, Schema.mutable),
  setup: ApexTestSetupDataSchema.pipe(Schema.Array, Schema.mutable, Schema.optional),
  codecoverage: CodeCoverageResultSchema.pipe(Schema.Array, Schema.mutable, Schema.optional)
}).annotations({ identifier: 'TestResult' });
export type TestResult = typeof TestResultSchema.Type;
