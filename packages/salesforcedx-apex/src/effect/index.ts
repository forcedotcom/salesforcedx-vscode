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
} from './testTypes.js';
export type { SyncTestConfiguration, TestResult, TestResultRaw } from '../tests/apiTypes.js';
export type { ApexDiagnostic } from './diagnostics.js';
export { SyncTestResultSchema } from './testSchemas.js';
export { SyncTestConfigurationSchema, TestItemSchema } from './schema/testPayloads.js';
export { getOrgWideCoverage, getPerClassCodeCoverage, getAggregateCodeCoverage } from './codeCoverage.js';
export {
  PerClassCoverageSchema,
  CodeCoverageResultSchema,
  AggregateCodeCoverageResultSchema
} from './coverageSchemas.js';
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
export {
  ApexLogBodyFetchError,
  ApexLogQueryError,
  ApexOperationError,
  ApexRequestError,
  ApexResponseDecodeError,
  InvalidSessionError
} from './schema/errors.js';
export { ApexCompileError, ApexRuntimeError, ApexReportError, causeMessage } from './errors.js';
export { FileOutput, FileOutputError } from './fileOutput.js';
export { writeResultFiles } from './writeResultFiles.js';
export type { WriteResultFilesOptions } from './writeResultFiles.js';
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
export {
  ApexClassId,
  ApexLogId,
  ApexTestSuiteId,
  ApexTriggerId,
  SalesforceId,
  TestRunId,
  UserId
} from './schema/salesforceId.js';
export { AsyncTestOptionsSchema } from './schema/wire/asyncTests.js';
export { AsyncTestProgressSchema, AsyncTestResultSchema, AsyncTestRunEventSchema } from './schema/asyncTests.js';
export { runTestAsynchronous } from './asyncTests.js';
export type { AsyncTestOptions } from './schema/wire/asyncTests.js';
export type { AsyncTestProgress, AsyncTestRunEvent, AsyncTestRunSummary } from './schema/asyncTests.js';
export type { AsyncTestPollingOptions, AsyncTestRun } from './asyncTests.js';
export {
  formatHumanReport,
  formatTapReport,
  formatJUnitReport,
  formatMarkdownTextReport,
  formatMarkdownTextReportStream
} from './reporters.js';
export type { HumanReporterOptions } from './reporters.js';
export type { MarkdownTextReporterOptions, OutputFormat, TestSortOrder } from '../reporters/markdownTextReporter.js';
export { buildCoverageMap, generateCoverageReports, IstanbulReports } from './coverageReports.js';
export type { CoverageReportOptions } from './coverageReports.js';
export type { CoverageSource } from '../reporters/coverageMap.js';
export { DefaultReportOptions, DefaultWatermarks } from '../reporters/coverageOptions.js';
export type { CoverageReporterOptions, CoverageReportFormats } from '../reporters/coverageOptions.js';
