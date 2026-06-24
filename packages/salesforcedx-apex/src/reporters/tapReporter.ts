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
import { buildTapDiagnostics } from './buildTapDiagnostics';

interface TapResult {
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

      const lines = [
        `1..${results.length}`,
        ...results.flatMap((testPoint) => [
          `${testPoint.outcome} ${testPoint.testNumber} ${testPoint.description}`,
          ...testPoint.diagnostics.map((s) => `# ${s}`)
        ]),
        ...(epilog ? epilog.map((c) => `# ${c}`) : [])
      ];
      return lines.join('\n') + '\n';
    } finally {
      HeapMonitor.getInstance().checkHeapSize('TapReporter.format');
    }
  }

  @elapsedTime()
  public buildTapResults(testResult: TestResult): TapResult[] {
    return testResult.tests.map((test: ApexTestResultData, index: number) => ({
      testNumber: index + 1,
      description: test.fullName,
      diagnostics: buildTapDiagnostics(test),
      outcome: test.outcome === ApexTestResultOutcome.Pass ? 'ok' : 'not ok'
    }));
  }
}
