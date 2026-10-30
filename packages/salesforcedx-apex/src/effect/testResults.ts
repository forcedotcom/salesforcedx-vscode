/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TestCategory, TestResult, TestResultRaw } from '../tests/types';
import * as Arr from 'effect/Array';
import { isNotNullable, isNotUndefined } from 'effect/Predicate';

export const calculatePercentage = (dividend: number, divisor: number): string =>
  dividend > 0 ? `${((dividend / divisor) * 100).toFixed()}%` : '0%';

const isFlowTest = (test: string | null): boolean => test?.startsWith('FlowTesting.') ?? false;

export const computeTestCategory = (testNamespace: string | null): TestCategory =>
  isFlowTest(testNamespace) ? 'Flow' : 'Apex';

/** Separates setup methods from tests and includes setup time in the total. */
export const transformTestResult = (rawResult: TestResultRaw): TestResult => {
  const [regularTests, setupMethods] = Arr.partition(rawResult.tests, test => test.isTestSetup === true);

  return {
    summary: {
      ...rawResult.summary,
      testSetupTimeInMs: rawResult.summary.testSetupTimeInMs,
      testTotalTimeInMs: (rawResult.summary.testSetupTimeInMs || 0) + rawResult.summary.testExecutionTimeInMs
    },
    tests: regularTests.map(({ isTestSetup, ...test }) => test),
    setup: setupMethods.map(test => ({
      ...(isNotUndefined(test.id) ? { id: test.id } : {}),
      ...(isNotNullable(test.stackTrace) ? { stackTrace: test.stackTrace } : {}),
      ...(isNotNullable(test.message) ? { message: test.message } : {}),
      ...(isNotUndefined(test.asyncApexJobId) ? { asyncApexJobId: test.asyncApexJobId } : {}),
      methodName: test.methodName,
      ...(isNotNullable(test.apexLogId) ? { apexLogId: test.apexLogId } : {}),
      apexClass: {
        ...(isNotUndefined(test.apexClass.id) ? { id: test.apexClass.id } : {}),
        name: test.apexClass.name,
        ...(isNotNullable(test.apexClass.namespacePrefix) ? { namespacePrefix: test.apexClass.namespacePrefix } : {}),
        fullName: test.apexClass.fullName
      },
      testSetupTime: test.runTime,
      fullName: test.fullName,
      ...(isNotUndefined(test.testTimestamp) ? { testTimestamp: test.testTimestamp } : {}),
      ...(isNotUndefined(test.diagnostic) ? { diagnostic: test.diagnostic } : {})
    })),
    codecoverage: rawResult.codecoverage
  };
};
