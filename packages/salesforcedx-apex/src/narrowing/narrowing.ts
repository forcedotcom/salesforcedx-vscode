/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Column, Row, TableConfig, Title } from '../utils';
import { TestResult, TestRunIdResult } from '../tests';
import { CLASS_ID_PREFIX, TEST_RUN_ID_PREFIX } from '../tests/constants';
import * as tsTypes from '@salesforce/ts-types';

export const isTestResult = (
  result: TestResult | TestRunIdResult
): result is TestResult => {
  return (
    (result as TestResult).summary !== undefined &&
    (result as TestResult).tests !== undefined
  );
};

export const { isString, isBoolean } = tsTypes;

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number';
};

export const isObject = (value: unknown): value is object => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

export const isArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value);
};

export const isNull = (value: unknown): value is null => {
  return value === null;
};

export const isPrimitive = (value: unknown): boolean => {
  return (
    isString(value) || isNumber(value) || isBoolean(value) || isNull(value)
  );
};

export const isRow = (obj: unknown): obj is Row => {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  for (const key in obj) {
    if (typeof key !== 'string' || typeof Reflect.get(obj, key) === 'string') {
      return false;
    }
  }
  return true;
};

export const isColumn = (obj: unknown): obj is Column => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof Reflect.get(obj, 'key') === 'string' &&
    typeof Reflect.get(obj, 'label') === 'string'
  );
};

export const isTitle = (obj: unknown): obj is Title => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof Reflect.get(obj, 'title') === 'string'
  );
};

export const isTableConfig = (obj: unknown): obj is TableConfig => {
  return (
    isObject(obj) &&
    Reflect.has(obj, 'title') &&
    isArray(Reflect.get(obj, 'columns')) &&
    (Reflect.get(obj, 'columns') as Column[]).length > 0
  );
};

export const isEmpty = (value: string | number): boolean => {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.length === 0)
  );
};

export const isNotQuotable = (value: unknown): boolean =>
  isNull(value) || isBoolean(value) || isNumber(value);

export function isValidTestRunID(testRunId: string): boolean {
  return (
    (testRunId.length === 15 || testRunId.length === 18) &&
    testRunId.startsWith(TEST_RUN_ID_PREFIX)
  );
}

export function isValidApexClassID(apexClassId: string): boolean {
  return (
    (apexClassId.length === 15 || apexClassId.length === 18) &&
    apexClassId.startsWith(CLASS_ID_PREFIX)
  );
}
