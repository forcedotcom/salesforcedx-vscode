/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type TestResult } from '../tests/types';
import { elapsedTime, HeapMonitor } from '../utils';
import { formatJUnit } from './junitFormatting';

export class JUnitReporter {
  @elapsedTime()
  public format(testResult: TestResult): string {
    HeapMonitor.getInstance().checkHeapSize('JUnitReporter.format');
    try {
      return formatJUnit(testResult);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('JUnitReporter.format');
    }
  }
}
