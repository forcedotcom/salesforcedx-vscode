/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TestCategory } from '../tests/types';
import * as Arr from 'effect/Array';
import * as Schema from 'effect/Schema';
import { ApexTestSetupDataSchema, type TestResult, type TestResultRaw } from './testSchemas';

export const calculatePercentage = (dividend: number, divisor: number): string =>
  dividend > 0 ? `${((dividend / divisor) * 100).toFixed()}%` : '0%';

export const isFlowTest = (test: string | null): boolean => test?.startsWith('FlowTesting.') ?? false;

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
    setup: setupMethods.map(test =>
      Schema.decodeUnknownSync(ApexTestSetupDataSchema)({
        id: test.id,
        stackTrace: test.stackTrace ?? null,
        message: test.message ?? null,
        asyncApexJobId: test.asyncApexJobId,
        methodName: test.methodName,
        apexLogId: test.apexLogId ?? null,
        apexClass: test.apexClass,
        testSetupTime: test.runTime,
        testTimestamp: test.testTimestamp,
        fullName: test.fullName,
        diagnostic: test.diagnostic
      })
    ),
    codecoverage: rawResult.codecoverage
  };
};
