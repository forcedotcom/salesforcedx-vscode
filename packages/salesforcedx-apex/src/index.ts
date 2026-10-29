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
export { LogService } from './logs';
export type { ApexLogGetOptions, LogRecord, LogResult } from './logs';
export { ApexClassId, SalesforceId, TestRunId } from './effect/schema/salesforceId';
export {
  JUnitReporter,
  TapReporter,
  HumanReporter,
  CoverageReporter,
  DefaultReportOptions,
  DefaultWatermarks,
  MarkdownTextFormatTransformer
} from './reporters';
export type {
  CoverageReporterOptions,
  CoverageReportFormats,
  MarkdownTextFormatTransformerOptions,
  MarkdownTextReporterOptions,
  OutputFormat,
  TestSortOrder
} from './reporters';
export { TestService, ResultFormat, TestLevel } from './tests';
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
  SyncTestConfiguration,
  TestItem,
  TestResult,
  TestResultRaw,
  TestRunIdResult,
  TestSuiteMembershipRecord,
  PerClassCoverage
} from './tests';
export type { ApexDiagnostic, CommonOptions, LogLevel } from './utils';
