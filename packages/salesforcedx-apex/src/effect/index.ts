/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ExecuteAnonymousOptionsSchema, ExecuteAnonymousOutcomeSchema, executeAnonymous } from './executeAnonymous';
export type { ExecuteAnonymousOptions, ExecuteAnonymousOutcome } from './executeAnonymous';
export {
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError,
  ApexReportError,
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
export {
  AsyncTestOptionsSchema,
  AsyncTestProgressSchema,
  AsyncTestResultSchema,
  AsyncTestRunEventSchema,
  runTestAsynchronous
} from './asyncTests';
export type {
  AsyncTestOptions,
  AsyncTestPollingOptions,
  AsyncTestProgress,
  AsyncTestRun,
  AsyncTestRunEvent,
  AsyncTestRunSummary
} from './asyncTests';
export { formatHumanReport, formatTapReport, formatJUnitReport, formatMarkdownTextReport } from './reporters';
export type { HumanReporterOptions } from './reporters';
export type { MarkdownTextReporterOptions, OutputFormat, TestSortOrder } from '../reporters/markdownTextReporter';
export { buildCoverageMap, generateCoverageReports, IstanbulReports } from './coverageReports';
export type { CoverageReportOptions } from './coverageReports';
export type { CoverageSource } from '../reporters/coverageMap';
export { DefaultReportOptions, DefaultWatermarks } from '../reporters/coverageOptions';
export type { CoverageReporterOptions, CoverageReportFormats } from '../reporters/coverageOptions';
