/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { CancellationTokenSource } from './tests/cancellation';
export type { CancellationToken } from './tests/cancellation';
export type { ApexTestProgressReporter } from './tests/apiTypes';
export type { ExecuteAnonymousResponse, ApexExecuteOptions } from './execute/types';
export { ExecuteService } from './execute/executeService';
export { LogService } from './logs/logService';
export type { ApexLogGetOptions, LogRecord, LogResult } from './logs/types';
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
  ApexCodeCoverageAggregateRecord,
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
  CodeCoverageResult,
  OutputDirConfig,
  ResultFormat,
  SyncTestConfiguration,
  TestLevel,
  TestItem,
  TestResult,
  TestResultRaw,
  TestRunIdResult,
  TestSuiteMembershipRecord,
  PerClassCoverage
} from './tests/apiTypes';
export type { ApexDiagnostic, CommonOptions, LogLevel } from './utils/types';
