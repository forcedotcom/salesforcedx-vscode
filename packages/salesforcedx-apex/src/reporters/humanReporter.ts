/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TestResult } from '../tests/types';
import * as os from 'node:os';
import { elapsedTime, HeapMonitor } from '../utils';
import { formatHuman } from './formatHuman';

export class HumanReporter {
  @elapsedTime()
  public format(testResult: TestResult, detailedCoverage: boolean, concise = false, showCategory = false): string {
    HeapMonitor.getInstance().checkHeapSize('HumanReporter.format');
    try {
      return formatHuman(testResult, detailedCoverage, concise, showCategory, os.EOL);
    } finally {
      HeapMonitor.getInstance().checkHeapSize('HumanReporter.format');
    }
  }
}
