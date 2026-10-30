/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousOutcomeSchema, executeAnonymous } from './executeAnonymous.js';
export type { ExecuteAnonymousOptions, ExecuteAnonymousOutcome } from './executeAnonymous.js';
export { ApexDiagnosticSchema, getDiagnostic } from './diagnostics.js';
export { formatSyncResults, runTestSynchronous } from './syncTests.js';
export { transformTestResult } from './testResults.js';
export {
  ApexTestResultDataSchema,
  ApexTestResultDataRawSchema,
  ApexTestResultOutcomeSchema,
  ApexTestSetupDataSchema,
  TestResultRawSchema,
  TestResultSchema
} from '../tests/types.js';
export type { SyncTestConfiguration, TestResult, TestResultRaw } from '../tests/types.js';
export type { ApexDiagnostic } from './diagnostics.js';
export { SyncTestResultSchema } from './testSchemas.js';
export { SyncTestConfigurationSchema, TestItemSchema } from './schema/testPayloads.js';
export { getOrgWideCoverage, getPerClassCodeCoverage, getAggregateCodeCoverage } from './codeCoverage.js';
export { PerClassCoverageSchema, CodeCoverageResultSchema, AggregateCodeCoverageResultSchema } from './coverageSchemas.js';
export type { PerClassCoverage, CodeCoverageResult, AggregateCodeCoverageResult } from './coverageSchemas.js';
export {
  ApexCodeCoverageSchema,
  ApexCodeCoverageRecordSchema,
  ApexCodeCoverageAggregateSchema,
  ApexCodeCoverageAggregateRecordSchema,
  ApexOrgWideCoverageSchema
} from './schema/wire/coverage.js';
export type {
  ApexCodeCoverage,
  ApexCodeCoverageRecord,
  ApexCodeCoverageAggregate,
  ApexCodeCoverageAggregateRecord,
  ApexOrgWideCoverage
} from './schema/wire/coverage.js';
export { ApexLogBodyFetchError, ApexLogQueryError } from './schema/errors.js';
export {
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  causeMessage
} from './errors.js';
export { listLogs, getLogBody, streamLogs } from './logs.js';
export { ApexLogListItem } from './schema/wire/logs.js';
export { ListLogsOptionsSchema, LogStreamEventSchema } from './schema/logs.js';
export { QueryPageSchema } from './schema/queryPage.js';
export type { ListLogsOptions, LogStreamEvent } from './schema/logs.js';
export type { StreamLogsOptions } from './logs.js';
export { BuildSyncPayloadOptionsSchema, BuildAsyncPayloadOptionsSchema } from './schema/testPayloads.js';
export { buildSyncPayload, buildAsyncPayload } from './testPayloads.js';
export type { BuildSyncPayloadOptions, BuildAsyncPayloadOptions } from './schema/testPayloads.js';
export { TestSuiteSchema, TestSuiteMembershipSchema } from './schema/testSuites.js';
export { retrieveAllSuites, getTestsInSuite, buildSuite } from './testSuites.js';
export type { TestSuite, TestSuiteMembership } from './schema/testSuites.js';
export { ApexTestSuiteId } from '../schemas/salesforceId.js';
export { AsyncTestOptionsSchema } from './schema/wire/asyncTests.js';
export { AsyncTestProgressSchema, AsyncTestResultSchema, AsyncTestRunEventSchema } from './schema/asyncTests.js';
export { runTestAsynchronous } from './asyncTests.js';
export type { AsyncTestOptions } from './schema/wire/asyncTests.js';
export type { AsyncTestProgress, AsyncTestRunEvent, AsyncTestRunSummary } from './schema/asyncTests.js';
export type { AsyncTestPollingOptions, AsyncTestRun } from './asyncTests.js';
