/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Readable, ReadableOptions } from 'node:stream';
import { TestResult } from '../tests';
import { pushArrayToStream } from './utils';
import { elapsedTime } from '../utils';

export class TestResultStringifyStream extends Readable {
  constructor(
    private readonly testResult: TestResult,
    options?: ReadableOptions
  ) {
    super({ ...options, objectMode: true });
    this.testResult = testResult;
  }

  _read(): void {
    this.format();
    this.push(null); // Signal the end of the stream
  }

  @elapsedTime()
  public format(): void {
    const { summary } = this.testResult;
    // strip out vars not included in the summary data reported to the user

    // outer curly
    this.push('{');
    // summary
    this.push(`"summary":${JSON.stringify(summary)},`);

    this.buildTests();
    this.buildCodeCoverage();

    // closing outer curly
    this.push(`}`);
  }

  @elapsedTime()
  buildTests(): void {
    this.push('"tests":[');

    const numberOfTests = this.testResult.tests.length - 1;
    this.testResult.tests.forEach((test, index) => {
      const { perClassCoverage, ...testRest } = test;
      this.push(`${JSON.stringify(testRest).slice(0, -1)}`);
      if (perClassCoverage) {
        const numberOfPerClassCoverage = perClassCoverage.length - 1;
        this.push(',"perClassCoverage":[');
        perClassCoverage.forEach((pcc, index) => {
          const { coverage, ...coverageRest } = pcc;
          this.push(`${JSON.stringify(coverageRest).slice(0, -1)}`);
          this.push(`,"coverage":${JSON.stringify(coverage)}}`);
          if (numberOfPerClassCoverage !== index) {
            this.push(',');
          }
        });
        this.push(']');
      }
      // close the tests
      this.push('}');
      if (numberOfTests !== index) {
        this.push(',');
      }
    });

    this.push('],');
  }

  @elapsedTime()
  buildCodeCoverage(): void {
    if (this.testResult.codecoverage) {
      this.push('"codecoverage":[');
      const numberOfCodeCoverage = this.testResult.codecoverage.length - 1;
      this.testResult.codecoverage.forEach((coverage, index) => {
        const { coveredLines, uncoveredLines, ...theRest } = coverage;
        this.push(`${JSON.stringify(theRest).slice(0, -1)}`);
        this.push(',"coveredLines":[');
        pushArrayToStream(coveredLines, this);
        this.push('],"uncoveredLines":[');
        pushArrayToStream(uncoveredLines, this);
        this.push(']}');
        if (numberOfCodeCoverage !== index) {
          this.push(',');
        }
      });
      this.push(']');
    }
  }

  public static fromTestResult(testResult: TestResult) {
    return new TestResultStringifyStream(testResult);
  }
}
