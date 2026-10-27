/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ApexTestResultData, TestResult } from '../tests/types';
import { isEmpty } from '../narrowing';
import { formatStartTime, msToSecond } from '../utils/dateUtil';

// CLI currently has spaces in multiples of four for junit format.
const tab = '    ';
const timeProperties = new Set(['testExecutionTimeInMs', 'testTotalTimeInMs', 'commandTimeInMs']);
// Properties not in CLI junit spec.
const skippedProperties = new Set(['skipRate', 'totalLines', 'linesCovered']);

const xmlEscape = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export function* formatJUnitPropertyChunks(testResult: TestResult): Generator<string, void> {
  yield `${tab}${tab}<properties>\n`;
  for (const [key, value] of Object.entries(testResult.summary)) {
    if (isEmpty(value) || skippedProperties.has(key)) continue;
    const propertyName = timeProperties.has(key) ? key.replace('InMs', '') : key;
    const propertyValue = timeProperties.has(key)
      ? `${msToSecond(value)} s`
      : key === 'outcome' && value === 'Passed'
        ? 'Successful'
        : key === 'testStartTime'
          ? formatStartTime(value)
          : value;
    yield `${tab}${tab}${tab}<property name="${propertyName}" value="${propertyValue}"/>\n`;
  }
  yield `${tab}${tab}</properties>\n`;
}

export function* formatJUnitTestCaseChunks(tests: ApexTestResultData[]): Generator<string, void> {
  for (const test of tests) {
    yield `${tab}${tab}<testcase name="${xmlEscape(test.methodName)}" classname="${test.apexClass.fullName}" time="${msToSecond(test.runTime)}">\n`;
    if (test.outcome === 'Fail' || test.outcome === 'CompileFail') {
      yield `${tab}${tab}${tab}<failure message="${xmlEscape(isEmpty(test.message ?? '') ? '' : (test.message ?? ''))}">`;
      if (test.stackTrace) yield `<![CDATA[${test.stackTrace}]]>`;
      yield '</failure>\n';
    }
    yield `${tab}${tab}</testcase>\n`;
  }
}

export function* formatJUnitChunks(testResult: TestResult): Generator<string, void> {
  const { summary } = testResult;
  yield '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n';
  yield `${tab}<testsuite name="force.apex" timestamp="${summary.testStartTime}" hostname="${summary.hostname}" tests="${summary.testsRan}" failures="${summary.failing}"  errors="0"  time="${msToSecond(summary.testExecutionTimeInMs)}">\n`;
  yield* formatJUnitPropertyChunks(testResult);
  yield* formatJUnitTestCaseChunks(testResult.tests);
  yield `${tab}</testsuite>\n</testsuites>\n`;
}

export const formatJUnit = (testResult: TestResult): string => Array.from(formatJUnitChunks(testResult)).join('');
