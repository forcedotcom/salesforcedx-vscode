/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isEmpty } from '../narrowing';
import { type TestResult } from '../tests/types';
import { formatStartTime, msToSecond } from '../utils';
import { escapeXml, xmlCdata } from './escaping';

// cli currently has spaces in multiples of four for junit format
const tab = '    ';
const timeProperties = new Set(['testExecutionTimeInMs', 'testTotalTimeInMs', 'commandTimeInMs']);
// properties not in cli junit spec
const skippedProperties = new Set(['skipRate', 'totalLines', 'linesCovered']);

export const formatJUnitProperties = (summary: TestResult['summary']): string =>
  `${tab}${tab}<properties>\n${Object.entries(summary)
    .filter(([key, value]) => !isEmpty(value) && !skippedProperties.has(key))
    .map(([key, value]) => {
      const name = timeProperties.has(key) ? key.replace('InMs', '') : key;
      const formattedValue = timeProperties.has(key)
        ? `${msToSecond(value)} s`
        : key === 'outcome' && value === 'Passed'
          ? 'Successful'
          : key === 'testStartTime'
            ? formatStartTime(value)
            : String(value);
      return `${tab}${tab}${tab}<property name="${escapeXml(name)}" value="${escapeXml(formattedValue)}"/>\n`;
    })
    .join('')}${tab}${tab}</properties>\n`;

export const formatJUnitTestCases = (tests: TestResult['tests']): string =>
  tests
    .map(test => {
      const failure =
        test.outcome === 'Fail' || test.outcome === 'CompileFail'
          ? `${tab}${tab}${tab}<failure message="${escapeXml(test.message ?? '')}">${test.stackTrace ? xmlCdata(test.stackTrace) : ''}</failure>\n`
          : '';
      return `${tab}${tab}<testcase name="${escapeXml(test.methodName)}" classname="${escapeXml(String(test.apexClass.fullName))}" time="${msToSecond(test.runTime)}">\n${failure}${tab}${tab}</testcase>\n`;
    })
    .join('');

export const formatJUnit = ({ summary, tests }: TestResult): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    '<testsuites>\n',
    `${tab}<testsuite name="force.apex" `,
    `timestamp="${escapeXml(String(summary.testStartTime))}" `,
    `hostname="${escapeXml(String(summary.hostname))}" `,
    `tests="${summary.testsRan}" `,
    `failures="${summary.failing}"  `,
    'errors="0"  ',
    `time="${msToSecond(summary.testExecutionTimeInMs)}">\n`,
    formatJUnitProperties(summary),
    formatJUnitTestCases(tests),
    `${tab}</testsuite>\n`,
    '</testsuites>\n'
  ].join('');
