/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { isNullable } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { TestRunId } from '../schemas/salesforceId';
import { TestResultSchema, type TestResult, type TestRunIdResult } from '../tests/types';

export const isTestResult = (result: TestResult | TestRunIdResult): result is TestResult =>
  Schema.is(TestResultSchema)(result);

export const isEmpty = (value: string | number): boolean =>
  isNullable(value) || (typeof value === 'string' && value.length === 0);

export const isValidTestRunID = (testRunId: string): boolean => Schema.is(TestRunId)(testRunId);
