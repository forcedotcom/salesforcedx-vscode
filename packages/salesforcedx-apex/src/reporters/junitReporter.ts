/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ApexTestResultData,
  ApexTestResultOutcome,
  TestResult
} from '../tests/types';
import { msToSecond } from '../utils';

// cli currently has spaces in multiples of four for junit format
const tab = '    ';

const timeProperties = [
  'testExecutionTimeInMs',
  'testTotalTimeInMs',
  'commandTimeInMs'
];

// properties not in cli junit spec
const skippedProperties = ['skipRate', 'totalLines', 'linesCovered'];
export class JUnitReporter {
  public format(testResult: TestResult): string {
    const { summary, tests } = testResult;

    let output = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    output += `<testsuites>\n`;
    output += `${tab}<testsuite name="force.apex" `;
    output += `timestamp="${new Date(summary.testStartTime).toISOString()}" `;
    output += `hostname="${summary.hostname}" `;
    output += `tests="${summary.testsRan}" `;
    output += `failures="${summary.failing}"  `;
    output += `errors="0"  `;
    output += `time="${msToSecond(summary.testExecutionTimeInMs)}">\n`;

    output += this.buildProperties(testResult);
    output += this.buildTestCases(tests);

    output += `${tab}</testsuite>\n`;
    output += `</testsuites>\n`;
    return output;
  }

  private buildProperties(testResult: TestResult): string {
    let junitProperties = `${tab}${tab}<properties>\n`;

    Object.entries(testResult.summary).forEach(([key, value]) => {
      if (this.isEmpty(value) || skippedProperties.includes(key)) {
        return;
      }

      if (timeProperties.includes(key)) {
        value = `${msToSecond(value)} s`;
        key = key.replace('InMs', '');
      }

      if (key === 'outcome' && value === 'Passed') {
        value = 'Successful';
      }

      junitProperties += `${tab}${tab}${tab}<property name="${key}" value="${value}"/>\n`;
    });

    junitProperties += `${tab}${tab}</properties>\n`;
    return junitProperties;
  }

  private buildTestCases(tests: ApexTestResultData[]): string {
    let junitTests = '';

    for (const testCase of tests) {
      const methodName = this.xmlEscape(testCase.methodName);
      junitTests += `${tab}${tab}<testcase name="${methodName}" classname="${
        testCase.apexClass.fullName
      }" time="${msToSecond(testCase.runTime)}">\n`;

      if (
        testCase.outcome === ApexTestResultOutcome.Fail ||
        testCase.outcome === ApexTestResultOutcome.CompileFail
      ) {
        let message = this.isEmpty(testCase.message) ? '' : testCase.message;
        message = this.xmlEscape(message);
        junitTests += `${tab}${tab}${tab}<failure message="${message}">`;
        if (testCase.stackTrace) {
          junitTests += `<![CDATA[${testCase.stackTrace}]]>`;
        }
        junitTests += `</failure>\n`;
      }

      junitTests += `${tab}${tab}</testcase>\n`;
    }
    return junitTests;
  }

  private xmlEscape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private isEmpty(value: string | number): boolean {
    if (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.length === 0)
    ) {
      return true;
    }
    return false;
  }
}
