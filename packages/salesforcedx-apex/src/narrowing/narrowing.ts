/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestResult, TestRunIdResult } from '../tests';
import { CLASS_ID_PREFIX, TEST_RUN_ID_PREFIX } from '../tests/constants';

export const isTestResult = (
  result: TestResult | TestRunIdResult
): result is TestResult =>
  'summary' in result &&
  'tests' in result &&
  result.summary !== undefined &&
  result.tests !== undefined;

export const isEmpty = (value: string | number): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.length === 0);

export const isValidTestRunID = (testRunId: string): boolean =>
  isValidSalesforceId && testRunId.startsWith(TEST_RUN_ID_PREFIX);

export const isValidApexClassID = (apexClassId: string): boolean =>
  isValidSalesforceId(apexClassId) && apexClassId.startsWith(CLASS_ID_PREFIX);

const isValidSalesforceId = (id: string): boolean =>
  id.length === 15 || id.length === 18;
