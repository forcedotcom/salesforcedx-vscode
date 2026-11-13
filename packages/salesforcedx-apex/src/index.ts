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
  TraceFlagEntityId,
  TestRunId,
  UserId
} from './schemas/salesforceId';
export { formatJUnit } from './reporters/junitFormatting';
export { formatTap } from './reporters/tapFormatting';
export { formatHuman } from './reporters/humanFormatting';
export { CoverageReporter } from './reporters/coverageReporter';
export { DefaultReportOptions, DefaultWatermarks } from './reporters/coverageOptions';
export { MarkdownTextFormatTransformer } from './reporters/markdownTextFormatTransformer';
export type { CoverageReporterOptions, CoverageReportFormats } from './reporters/coverageOptions';
export type { MarkdownTextFormatTransformerOptions } from './reporters/markdownTextFormatTransformer';
export type { MarkdownTextReporterOptions, OutputFormat, TestSortOrder } from './reporters/markdownTextReporter';
export { TestService } from './tests/testService';
export { ResultFormat, ResultFormatSchema, TestLevel, TestLevelSchema } from './tests/types';
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
  SyncTestConfiguration,
  TestItem,
  TestResult,
  TestResultRaw,
  TestRunIdResult,
  TestSuiteMembershipRecord
} from './tests/types';
export type { ApexDiagnostic } from './effect/diagnostics';
export type { CommonOptions, LogLevel } from './utils/types';
