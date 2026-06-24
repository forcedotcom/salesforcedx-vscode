/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexTestResultOutcome, TestResult } from '../tests';
import {
  elapsedTime,
  formatStartTime,
  HeapMonitor,
  msToSecond
} from '../utils';
import { Readable, ReadableOptions } from 'node:stream';
import { isEmpty } from '../narrowing';
import { Logger } from '@salesforce/core';

// cli currently has spaces in multiples of four for junit format
const tab = '    ';

const timeProperties = [
  'testExecutionTimeInMs',
  'testTotalTimeInMs',
  'commandTimeInMs'
];

// properties not in cli junit spec
const skippedProperties = ['skipRate', 'totalLines', 'linesCovered'];

type JUnitFormatTransformerOptions = ReadableOptions & {
  bufferSize?: number;
};

export class JUnitFormatTransformer extends Readable {
  private logger: Logger;
  private buffer: string;
  private bufferSize: number;

  constructor(
    private readonly testResult: TestResult,
    options?: JUnitFormatTransformerOptions
  ) {
    super(options);
    this.testResult = testResult;
    this.logger = Logger.childFromRoot('JUnitFormatTransformer');
    this.buffer = '';
    this.bufferSize = options?.bufferSize || 256; // Default buffer size is 256
  }

  private pushToBuffer(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length >= this.bufferSize) {
      this.push(this.buffer);
      this.buffer = '';
    }
  }

  _read(): void {
    this.logger.trace('starting _read');
    HeapMonitor.getInstance().checkHeapSize('JUnitFormatTransformer._read');
    this.format();
    if (this.buffer.length > 0) {
      this.push(this.buffer);
    }
    this.push(null); // Signal the end of the stream
    this.logger.trace('finishing _read');
    HeapMonitor.getInstance().checkHeapSize('JUnitFormatTransformer._read');
  }

  @elapsedTime()
  public format(): void {
    const { summary } = this.testResult;

    this.pushToBuffer(`<?xml version="1.0" encoding="UTF-8"?>\n`);
    this.pushToBuffer(`<testsuites>\n`);
    this.pushToBuffer(`${tab}<testsuite name="force.apex" `);
    this.pushToBuffer(`timestamp="${summary.testStartTime}" `);
    this.pushToBuffer(`hostname="${summary.hostname}" `);
    this.pushToBuffer(`tests="${summary.testsRan}" `);
    this.pushToBuffer(`failures="${summary.failing}"  `);
    this.pushToBuffer(`errors="0"  `);
    this.pushToBuffer(`time="${msToSecond(summary.testExecutionTimeInMs)}">\n`);

    this.buildProperties();
    this.buildTestCases();

    this.pushToBuffer(`${tab}</testsuite>\n`);
    this.pushToBuffer(`</testsuites>\n`);
  }

  @elapsedTime()
  buildProperties(): void {
    this.pushToBuffer(`${tab}${tab}<properties>\n`);

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

      this.pushToBuffer(
        `${tab}${tab}${tab}<property name="${key}" value="${value}"/>\n`
      );
      // this call to setImmediate will schedule the closure on the event loop
      // this action causing the current code to yield to the event loop
      // allowing other processes to get time on the event loop
      setImmediate(() => {});
    });

    this.pushToBuffer(`${tab}${tab}</properties>\n`);
  }

  @elapsedTime()
  buildTestCases(): void {
    const testCases = this.testResult.tests;

    for (const testCase of testCases) {
      const methodName = JUnitFormatTransformer.xmlEscape(testCase.methodName);
      this.pushToBuffer(
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
        this.pushToBuffer(`${tab}${tab}${tab}<failure message="${message}">`);
        if (testCase.stackTrace) {
          this.pushToBuffer(`<![CDATA[${testCase.stackTrace}]]>`);
        }
        this.pushToBuffer(`</failure>\n`);
      }

      this.pushToBuffer(`${tab}${tab}</testcase>\n`);
      // this call to setImmediate will schedule the closure on the event loop
      // this action causing the current code to yield to the event loop
      // allowing other processes to get time on the event loop
      setImmediate(() => {});
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
