/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexTestResultOutcome, TestResult } from '../tests';
import { elapsedTime, formatStartTime, msToSecond } from '../utils';
import { Readable, ReadableOptions } from 'node:stream';
import { isEmpty } from '../narrowing';

// cli currently has spaces in multiples of four for junit format
const tab = '    ';

const timeProperties = [
  'testExecutionTimeInMs',
  'testTotalTimeInMs',
  'commandTimeInMs'
];

// properties not in cli junit spec
const skippedProperties = ['skipRate', 'totalLines', 'linesCovered'];

export class JUnitFormatTransformer extends Readable {
  constructor(
    private readonly testResult: TestResult,
    options?: ReadableOptions
  ) {
    super(options);
    this.testResult = testResult;
  }

  _read(): void {
    this.format();
    this.push(null); // Signal the end of the stream
  }

  @elapsedTime()
  public format(): void {
    const { summary } = this.testResult;

    this.push(`<?xml version="1.0" encoding="UTF-8"?>\n`);
    this.push(`<testsuites>\n`);
    this.push(`${tab}<testsuite name="force.apex" `);
    this.push(`timestamp="${summary.testStartTime}" `);
    this.push(`hostname="${summary.hostname}" `);
    this.push(`tests="${summary.testsRan}" `);
    this.push(`failures="${summary.failing}"  `);
    this.push(`errors="0"  `);
    this.push(`time="${msToSecond(summary.testExecutionTimeInMs)}">\n`);

    this.buildProperties();
    this.buildTestCases();

    this.push(`${tab}</testsuite>\n`);
    this.push(`</testsuites>\n`);
  }

  @elapsedTime()
  buildProperties(): void {
    this.push(`${tab}${tab}<properties>\n`);

    Object.entries(this.testResult.summary).forEach(([key, value]) => {
      if (isEmpty(value) || skippedProperties.includes(key)) {
        return;
      }

      if (timeProperties.includes(key)) {
        value = `${msToSecond(value)} s`;
        key = key.replace('InMs', '');
      }

      if (key === 'outcome' && value === 'Passed') {
        value = 'Successful';
      }

      if (key === 'testStartTime') {
        value = formatStartTime(value);
      }

      this.push(
        `${tab}${tab}${tab}<property name="${key}" value="${value}"/>\n`
      );
    });

    this.push(`${tab}${tab}</properties>\n`);
  }

  @elapsedTime()
  buildTestCases(): void {
    const testCases = this.testResult.tests;

    for (const testCase of testCases) {
      const methodName = JUnitFormatTransformer.xmlEscape(testCase.methodName);
      this.push(
        `${tab}${tab}<testcase name="${methodName}" classname="${
          testCase.apexClass.fullName
        }" time="${msToSecond(testCase.runTime)}">\n`
      );

      if (
        testCase.outcome === ApexTestResultOutcome.Fail ||
        testCase.outcome === ApexTestResultOutcome.CompileFail
      ) {
        let message = isEmpty(testCase.message) ? '' : testCase.message;
        message = JUnitFormatTransformer.xmlEscape(message);
        this.push(`${tab}${tab}${tab}<failure message="${message}">`);
        if (testCase.stackTrace) {
          this.push(`<![CDATA[${testCase.stackTrace}]]>`);
        }
        this.push(`</failure>\n`);
      }

      this.push(`${tab}${tab}</testcase>\n`);
    }
  }

  private static xmlEscape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
