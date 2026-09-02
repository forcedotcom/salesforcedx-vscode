/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { TestService } from './testService';
export { ApexTestResultOutcome, ApexTestRunResultStatus, ResultFormat, TestCategory, TestLevel } from './types';
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
} from './types';
