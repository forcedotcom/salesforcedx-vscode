/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TestResult } from '../tests/types';
import { runReportSync } from '../effect/errors';
import { formatHumanReport } from '../effect/reporters';

/** Compatibility adapter for the Effect-native human reporter. */
export class HumanReporter {
  public format(testResult: TestResult, detailedCoverage: boolean, concise = false, showCategory = false): string {
    return runReportSync(formatHumanReport(testResult, { detailedCoverage, concise, showCategory }));
  }
}
