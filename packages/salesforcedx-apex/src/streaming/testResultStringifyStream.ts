/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Logger } from '@salesforce/core';
import { Readable, ReadableOptions } from 'node:stream';
import { TestResult } from '../tests';
import { elapsedTime } from '../utils';

type TestResultStringifyStreamOptions = ReadableOptions & {
  bufferSize?: number;
};

export class TestResultStringifyStream extends Readable {
  private readonly logger: Logger;
  private buffer: string;
  private readonly bufferSize: number;

  constructor(
    private readonly testResult: TestResult,
    options?: TestResultStringifyStreamOptions
  ) {
    super({ ...options, objectMode: true });
    this.testResult = testResult;
    this.logger = Logger.childFromRoot('TestResultStringifyStream');
    this.buffer = '';
    this.bufferSize = options?.bufferSize || 256; // Default buffer size is 256
  }

  private pushToBuffer(data: string): void {
    this.buffer += data;
    if (this.buffer.length >= this.bufferSize) {
      this.push(this.buffer);
      this.buffer = '';
    }
  }

  _read(): void {
    this.logger.trace('starting format');
    this.format();
    if (this.buffer.length > 0) {
      this.push(this.buffer);
      this.buffer = '';
    }
    this.push(null); // Signal the end of the stream
    this.logger.trace('finishing format');
  }

  @elapsedTime()
  public format(): void {
    const { summary } = this.testResult;
    // strip out vars not included in the summary data reported to the user

    // outer curly
    this.pushToBuffer('{');
    // summary
    this.pushToBuffer(`"summary":${JSON.stringify(summary)},`);

    this.buildTests();
    this.buildCodeCoverage();

    // closing outer curly
    this.pushToBuffer(`}`);
  }

  @elapsedTime()
  buildTests(): void {
    this.pushToBuffer('"tests":[');

    const numberOfTests = this.testResult.tests.length - 1;
    this.testResult.tests.forEach((test, index) => {
      const { perClassCoverage, ...testRest } = test;
      this.pushToBuffer(`${JSON.stringify(testRest).slice(0, -1)}`);
      if (perClassCoverage) {
        const numberOfPerClassCoverage = perClassCoverage.length - 1;
        this.pushToBuffer(',"perClassCoverage":[');
        perClassCoverage.forEach((pcc, index) => {
          const { coverage, ...coverageRest } = pcc;
          this.pushToBuffer(`${JSON.stringify(coverageRest).slice(0, -1)}`);
          this.pushToBuffer(`,"coverage":${JSON.stringify(coverage)}}`);
          if (numberOfPerClassCoverage !== index) {
            this.pushToBuffer(',');
          }
        });
        this.pushToBuffer(']');
        // this call to setImmediate will schedule the closure on the event loop
        // this action causing the current code to yield to the event loop
        // allowing other processes to get time on the event loop
        setImmediate(() => {});
      }
      // close the tests
      this.pushToBuffer('}');
      if (numberOfTests !== index) {
        this.pushToBuffer(',');
      }
    });

    this.pushToBuffer(']');
  }

  @elapsedTime()
  buildCodeCoverage(): void {
    if (this.testResult.codecoverage) {
      this.pushToBuffer(',"codecoverage":[');
      const numberOfCodeCoverage = this.testResult.codecoverage.length - 1;
      this.testResult.codecoverage.forEach((coverage, index) => {
        const { coveredLines, uncoveredLines, ...theRest } = coverage;
        this.pushToBuffer(`${JSON.stringify(theRest).slice(0, -1)}`);
        this.pushToBuffer(',"coveredLines":[');
        this.pushArrayToBuffer(coveredLines);
        this.pushToBuffer('],"uncoveredLines":[');
        this.pushArrayToBuffer(uncoveredLines);
        this.pushToBuffer(']}');
        if (numberOfCodeCoverage !== index) {
          this.pushToBuffer(',');
        }
        // this call to setImmediate will schedule the closure on the event loop
        // this action causing the current code to yield to the event loop
        // allowing other processes to get time on the event loop
        setImmediate(() => {});
      });
      this.pushToBuffer(']');
    }
  }

  public static fromTestResult(
    testResult: TestResult,
    options?: TestResultStringifyStreamOptions
  ) {
    return new TestResultStringifyStream(testResult, options);
  }

  private pushArrayToBuffer(array: number[]) {
    const chunkSize = 1000;
    for (let i = 0; i < array.length; i += chunkSize) {
      const chunk = array.slice(i, i + chunkSize);
      let jsonString = JSON.stringify(chunk);
      jsonString = jsonString.slice(1, -1); // remove '[' and ']'
      this.pushToBuffer(jsonString);
      if (i + chunkSize < array.length) {
        this.pushToBuffer(','); // add comma for all but the last chunk
      }
    }
  }
}
