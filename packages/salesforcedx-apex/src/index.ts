/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { CancellationTokenSource } from './tests/cancellation';
export type { CancellationToken } from './tests/cancellation';
export type { ApexTestProgressReporter } from './tests/types';
export type { ExecuteAnonymousResponse, ApexExecuteOptions } from './execute/types';
export { ExecuteService } from './execute/executeService';
export { LogService } from './logs/logService';
export type { ApexLogGetOptions, LogRecord, LogResult } from './logs/types';
export {
  ApexClassId,
  ApexLogId,
  ApexTestSuiteId,
  ApexTriggerId,
  SalesforceId,
  TestRunId,
  UserId
} from './schemas/salesforceId';
export { JUnitReporter } from './reporters/junitReporter';
export { TapReporter } from './reporters/tapReporter';
export { HumanReporter } from './reporters/humanReporter';
export { CoverageReporter, DefaultReportOptions, DefaultWatermarks } from './reporters/coverageReporter';
export { MarkdownTextFormatTransformer } from './reporters/markdownTextFormatTransformer';
export type { CoverageReporterOptions, CoverageReportFormats } from './reporters/coverageReporter';
export type { MarkdownTextFormatTransformerOptions } from './reporters/markdownTextFormatTransformer';
export type { MarkdownTextReporterOptions, OutputFormat, TestSortOrder } from './reporters/markdownTextReporter';
export { TestService } from './tests/testService';
export type {
  ApexCodeCoverage,
  ApexCodeCoverageRecord,
  ApexCodeCoverageAggregate,
  ApexCodeCoverageAggregateRecord
} from './effect/schema/wire/coverage';
export type { CodeCoverageResult, PerClassCoverage } from './effect/coverageSchemas';
export type {
  ApexTestQueueItem,
  ApexTestQueueItemRecord,
  ApexTestQueueItemStatus,
  ApexTestProgressValue,
  ApexTestResultData,
  ApexTestResultDataRaw,
  ApexTestResultOutcome,
  ApexTestRunResultStatus,
  ApexTestSetupData,
  AsyncTestArrayConfiguration,
  AsyncTestConfiguration,
  OutputDirConfig,
  ResultFormat,
  SyncTestConfiguration,
  TestLevel,
  TestItem,
  TestResult,
  TestResultRaw,
  TestRunIdResult,
  TestSuiteMembershipRecord
} from './tests/types';
export type { ApexDiagnostic } from './effect/diagnostics';
export type { CommonOptions, LogLevel } from './utils/types';
