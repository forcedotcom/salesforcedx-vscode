/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { executeAnonymous } from './executeAnonymous';
export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousOutcomeSchema } from './schema/executeAnonymous';
export type { ExecuteAnonymousOptions, ExecuteAnonymousOutcome } from './schema/executeAnonymous';
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
  ApexLogBodyFetchError,
  ApexCompileError,
  ApexLogQueryError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError
} from './schema/errors';
export { ApexReportError, causeMessage } from './errors';
export { listLogs, getLogBody, streamLogs } from './logs';
export { ApexLogListItem } from './schema/wire/logs';
export { ListLogsOptionsSchema, LogStreamEventSchema } from './schema/logs';
export type { ListLogsOptions, LogStreamEvent } from './schema/logs';
export type { StreamLogsOptions } from './logs';
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
export { formatHumanReport, formatTapReport, formatJUnitReport, formatMarkdownTextReport } from './reporters';
export type { HumanReporterOptions } from './reporters';
export type { MarkdownTextReporterOptions, OutputFormat, TestSortOrder } from '../reporters/markdownTextReporter';
export { buildCoverageMap, generateCoverageReports, IstanbulReports } from './coverageReports';
export type { CoverageReportOptions } from './coverageReports';
export type { CoverageSource } from '../reporters/coverageMap';
export { DefaultReportOptions, DefaultWatermarks } from '../reporters/coverageOptions';
export type { CoverageReporterOptions, CoverageReportFormats } from '../reporters/coverageOptions';
