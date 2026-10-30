/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousOutcomeSchema, executeAnonymous } from './executeAnonymous';
export type { ExecuteAnonymousOptions, ExecuteAnonymousOutcome } from './executeAnonymous';
export { ApexDiagnosticSchema, getDiagnostic } from './diagnostics';
export type { ApexDiagnostic } from './diagnostics';
export { formatSyncResults, runTestSynchronous } from './syncTests';
export { transformTestResult } from './testResults';
export {
  ApexTestResultDataSchema,
  ApexTestResultDataRawSchema,
  ApexTestResultOutcomeSchema,
  ApexTestSetupDataSchema,
  SyncTestConfigurationSchema,
  SyncTestResultSchema,
  TestItemSchema,
  TestResultRawSchema,
  TestResultSchema
} from './testSchemas';
export type { SyncTestConfiguration, TestResult, TestResultRaw } from './testSchemas';
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
  ApexCompileError,
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
export type { BuildSyncPayloadOptions, BuildAsyncPayloadOptions } from './schema/testPayloads';
export { buildSyncPayload, buildAsyncPayload } from './testPayloads';
export { TestSuiteSchema, TestSuiteMembershipSchema } from './schema/testSuites';
export type { TestSuite, TestSuiteMembership } from './schema/testSuites';
export { retrieveAllSuites, getTestsInSuite, buildSuite } from './testSuites';
