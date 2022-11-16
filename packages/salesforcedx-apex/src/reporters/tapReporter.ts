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

export interface TapResult {
  description: string;
  diagnostics: string[];
  outcome: string;
  testNumber: number;
}

export class TapReporter {
  public format(testResult: TestResult, epilog?: string[]): string {
    const results: TapResult[] = this.buildTapResults(testResult);
    const testPointCount = results.length;

    let out = '';
    out = out.concat(`1..${testPointCount}\n`);
    results.forEach(testPoint => {
      out = out.concat(
        `${testPoint.outcome} ${testPoint.testNumber} ${testPoint.description}\n`
      );
      testPoint.diagnostics.forEach(s => {
        out = out.concat(`# ${s}\n`);
      });
    });

    epilog?.forEach(c => {
      out = out.concat(`# ${c}\n`);
    });
    return out;
  }

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

  private buildTapDiagnostics(testResult: ApexTestResultData): string[] {
    const message = [];
    if (testResult.outcome !== 'Pass') {
      if (testResult.message) {
        const startsWithNewlineRegex = new RegExp(/^[/\r\n|\r|\n][\w]*/gim);
        if (startsWithNewlineRegex.test(testResult.message)) {
          testResult.message.split(/\r\n|\r|\n/g).forEach(msg => {
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
        testResult.stackTrace.split('\n').forEach(line => {
          message.push(line);
        });
      }
    }
    return message;
  }
}
