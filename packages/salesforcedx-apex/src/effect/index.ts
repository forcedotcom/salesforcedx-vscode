/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousOutcomeSchema, executeAnonymous } from './executeAnonymous';
export type { ExecuteAnonymousOptions, ExecuteAnonymousOutcome } from './executeAnonymous';
export { getDiagnostic } from './diagnostics';
export { formatSyncResults, runTestSynchronous } from './syncTests';
export { transformTestResult } from './testResults';
export {
  ApexDiagnosticSchema,
  ApexTestResultDataSchema,
  ApexTestResultDataRawSchema,
  ApexTestResultOutcomeSchema,
  ApexTestSetupDataSchema,
  TestResultRawSchema,
  TestResultSchema
} from '../tests/types';
export type { SyncTestConfiguration, TestResult, TestResultRaw } from '../tests/types';
export type { ApexDiagnostic } from './diagnostics';
export { SyncTestResultSchema } from './testSchemas';
export { SyncTestConfigurationSchema, TestItemSchema } from './schema/testPayloads';
export { getOrgWideCoverage, getPerClassCodeCoverage, getAggregateCodeCoverage } from './codeCoverage';
export { PerClassCoverageSchema, CodeCoverageResultSchema, AggregateCodeCoverageResultSchema } from './coverageSchemas';
export type { PerClassCoverage, CodeCoverageResult, AggregateCodeCoverageResult } from './coverageSchemas';
export {
  ApexCodeCoverageSchema,
  ApexCodeCoverageRecordSchema,
  ApexCodeCoverageAggregateSchema,
  ApexCodeCoverageAggregateRecordSchema,
  ApexOrgWideCoverageSchema
} from './schema/wire/coverage';
export type {
  ApexCodeCoverage,
  ApexCodeCoverageRecord,
  ApexCodeCoverageAggregate,
  ApexCodeCoverageAggregateRecord,
  ApexOrgWideCoverage
} from './schema/wire/coverage';
export {
  ApexLogBodyFetchError,
  ApexCompileError,
  ApexLogQueryError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  causeMessage
} from './errors';
export { listLogs, getLogBody, streamLogs } from './logs';
export { ApexLogQueryError, ApexLogBodyFetchError } from './schema/errors';
export { ApexLogListItem } from './schema/wire/logs';
export { ListLogsOptionsSchema, LogStreamEventSchema } from './schema/logs';
export { QueryPageSchema } from './schema/queryPage';
export type { ListLogsOptions } from './schema/logs';
export type { LogStreamEvent, StreamLogsOptions } from './logs';
export { BuildSyncPayloadOptionsSchema, BuildAsyncPayloadOptionsSchema } from './schema/testPayloads';
export { buildSyncPayload, buildAsyncPayload } from './testPayloads';
export type { BuildSyncPayloadOptions, BuildAsyncPayloadOptions } from './schema/testPayloads';
export { TestSuiteSchema, TestSuiteMembershipSchema } from './schema/testSuites';
export { retrieveAllSuites, getTestsInSuite, buildSuite } from './testSuites';
export type { TestSuite, TestSuiteMembership } from './schema/testSuites';
export { AsyncTestOptionsSchema } from './schema/wire/asyncTests';
export { AsyncTestProgressSchema, AsyncTestResultSchema, AsyncTestRunEventSchema } from './schema/asyncTests';
export { runTestAsynchronous } from './asyncTests';
export type { AsyncTestOptions } from './schema/wire/asyncTests';
export type { AsyncTestProgress, AsyncTestRunEvent, AsyncTestRunSummary } from './schema/asyncTests';
export type { AsyncTestPollingOptions, AsyncTestRun } from './asyncTests';
