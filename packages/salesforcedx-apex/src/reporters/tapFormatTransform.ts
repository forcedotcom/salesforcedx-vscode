/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Readable, ReadableOptions } from 'node:stream';
import {
  ApexTestResultData,
  ApexTestResultOutcome,
  TestResult
} from '../tests';
import { elapsedTime } from '../utils';

export interface TapResult {
  description: string;
  diagnostics: string[];
  outcome: string;
  testNumber: number;
}

export class TapFormatTransformer extends Readable {
  private testResult: TestResult;
  private epilogue?: string[];

  constructor(
    testResult: TestResult,
    epilogue?: string[],
    options?: ReadableOptions
  ) {
    super(options);
    this.testResult = testResult;
    this.epilogue = epilogue;
  }

  _read(): void {
    this.format();
    this.push(null); // Signal the end of the stream
  }

  @elapsedTime()
  public format(): void {
    const testPointCount = this.testResult.tests.length;

    this.push(`1..${testPointCount}\n`);
    this.buildTapResults();

    this.epilogue?.forEach((c) => {
      this.push(`# ${c}\n`);
    });
  }

  @elapsedTime()
  public buildTapResults(): void {
    this.testResult.tests.forEach((test: ApexTestResultData, index: number) => {
      const testNumber = index + 1;
      const outcome =
        test.outcome === ApexTestResultOutcome.Pass ? 'ok' : 'not ok';
      this.push(`${outcome} ${testNumber} ${test.fullName}\n`);
      this.buildTapDiagnostics(test).forEach((s) => {
        this.push(`# ${s}\n`);
      });
    });
  }

  @elapsedTime()
  private buildTapDiagnostics(testResult: ApexTestResultData): string[] {
    const message = [];
    if (testResult.outcome !== 'Pass') {
      if (testResult.message) {
        const startsWithNewlineRegex = new RegExp(/^[/\r\n|\r|\n]\w*/gim);
        if (startsWithNewlineRegex.test(testResult.message)) {
          testResult.message.split(/\r\n|\r|\n/g).forEach((msg) => {
            if (msg && msg.length > 0) {
              message.push(msg.trim());
            }
          });
        } else {
          message.push(testResult.message);
        }
      } else {
        message.push('Unknown error');
      }

      if (testResult.stackTrace) {
        testResult.stackTrace.split('\n').forEach((line) => {
          message.push(line);
        });
      }
    }
    return message;
  }
}
