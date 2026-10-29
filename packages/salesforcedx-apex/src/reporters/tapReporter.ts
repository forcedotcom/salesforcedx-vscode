/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type TestResult } from '../tests/types';
import { elapsedTime, HeapMonitor } from '../utils';
import { buildTapResults, formatTap } from './tapFormatting';

export class TapReporter {
  @elapsedTime()
  public format(testResult: TestResult, epilog?: string[]): string {
    HeapMonitor.getInstance().checkHeapSize('TapReporter.format');
    try {
      return formatTap(this.buildTapResults(testResult), epilog);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('TapReporter.format');
    }
  }

  @elapsedTime()
  private buildTapResults(testResult: TestResult): ReturnType<typeof buildTapResults> {
    return buildTapResults(testResult);
  }
}
