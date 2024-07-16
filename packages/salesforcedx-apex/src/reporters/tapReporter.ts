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
} from '../tests';
import { elapsedTime, HeapMonitor } from '../utils';
import * as os from 'node:os';

export interface TapResult {
  description: string;
  diagnostics: string[];
  outcome: string;
  testNumber: number;
}

export class TapReporter {
  @elapsedTime()
  public format(testResult: TestResult, epilog?: string[]): string {
    HeapMonitor.getInstance().checkHeapSize('TapReporter.format');
    try {
      const results: TapResult[] = this.buildTapResults(testResult);
      const testPointCount = results.length;

      let out = '';
      out = out.concat(`1..${testPointCount}\n`);
      results.forEach((testPoint) => {
        out = out.concat(
          `${testPoint.outcome} ${testPoint.testNumber} ${testPoint.description}\n`
        );
        testPoint.diagnostics.forEach((s) => {
          out = out.concat(`# ${s}\n`);
        });
      });

      epilog?.forEach((c) => {
        out = out.concat(`# ${c}\n`);
      });
      return out;
    } finally {
      HeapMonitor.getInstance().checkHeapSize('TapReporter.format');
    }
  }

  @elapsedTime()
  public buildTapResults(testResult: TestResult): TapResult[] {
    const tapResults: TapResult[] = [];
    testResult.tests.forEach((test: ApexTestResultData, index: number) => {
      const testNumber = index + 1;
      const outcome =
        test.outcome === ApexTestResultOutcome.Pass ? 'ok' : 'not ok';
      tapResults.push({
        testNumber,
        description: test.fullName,
        diagnostics: this.buildTapDiagnostics(test),
        outcome
      });
    });
    return tapResults;
  }

  @elapsedTime()
  private buildTapDiagnostics(testResult: ApexTestResultData): string[] {
    const message = [];
    if (testResult.outcome !== 'Pass') {
      if (testResult.message) {
        const startsWithNewlineRegex = new RegExp(/^[/\r\n|\r|\n][\w]*/gim);
        if (startsWithNewlineRegex.test(testResult.message)) {
          testResult.message.split(/\r\n|\r|\n/g).forEach((msg) => {
            if (msg?.length > 0) {
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
        testResult.stackTrace.split(os.EOL).forEach((line) => {
          message.push(line);
        });
      }
    }
    return message;
  }
}
