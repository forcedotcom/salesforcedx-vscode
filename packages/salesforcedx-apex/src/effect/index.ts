/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousOutcomeSchema, executeAnonymous } from './executeAnonymous';
export type { ExecuteAnonymousOptions, ExecuteAnonymousOutcome } from './executeAnonymous';
export { getOrgWideCoverage, getPerClassCodeCoverage, getAggregateCodeCoverage } from './codeCoverage';
export {
  ApexCodeCoverageSchema,
  ApexCodeCoverageRecordSchema,
  ApexCodeCoverageAggregateSchema,
  ApexCodeCoverageAggregateRecordSchema,
  ApexOrgWideCoverageSchema,
  PerClassCoverageSchema,
  CodeCoverageResultSchema,
  AggregateCodeCoverageResultSchema
} from './coverageSchemas';
export type {
  ApexCodeCoverage,
  ApexCodeCoverageRecord,
  ApexCodeCoverageAggregate,
  ApexCodeCoverageAggregateRecord,
  ApexOrgWideCoverage,
  PerClassCoverage,
  CodeCoverageResult,
  AggregateCodeCoverageResult
} from './coverageSchemas';
export {
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  causeMessage
} from './errors';
export {
  ApexLogListItem,
  ListLogsOptionsSchema,
  LogStreamEventSchema,
  ApexLogQueryError,
  ApexLogBodyFetchError,
  listLogs,
  getLogBody,
  streamLogs
} from './logs';
export type { ListLogsOptions, LogStreamEvent, StreamLogsOptions } from './logs';
export {
  BuildSyncPayloadOptionsSchema,
  BuildAsyncPayloadOptionsSchema,
  buildSyncPayload,
  buildAsyncPayload
} from './testPayloads';
export type { BuildSyncPayloadOptions, BuildAsyncPayloadOptions } from './testPayloads';
export {
  TestSuiteSchema,
  TestSuiteMembershipSchema,
  retrieveAllSuites,
  getTestsInSuite,
  buildSuite
} from './testSuites';
export type { TestSuite, TestSuiteMembership } from './testSuites';
