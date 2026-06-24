/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { TestService, writeResultFiles } from './testService';
export { ApexTestResultOutcome, ApexTestRunResultStatus, ResultFormat, TestCategory, TestLevel } from './types';
export type {
  ApexCodeCoverageAggregate,
  ApexCodeCoverageAggregateRecord,
  ApexTestProgressValue,
  ApexTestResultData,
  ApexTestSetupData,
  AsyncTestArrayConfiguration,
  AsyncTestConfiguration,
  CodeCoverageResult,
  OutputDirConfig,
  SyncTestConfiguration,
  TestItem,
  TestResult,
  TestRunIdResult,
  PerClassCoverage
} from './types';
export { writeAsyncResultsToFile } from './asyncTests';
