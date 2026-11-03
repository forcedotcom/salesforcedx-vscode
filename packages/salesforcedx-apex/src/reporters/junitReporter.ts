/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { TestResult } from '../tests/types';
import { runReportSync } from '../effect/errors';
import { formatJUnitReport } from '../effect/reporters';

/** Compatibility adapter for the Effect-native JUnit reporter. */
export class JUnitReporter {
  public format(testResult: TestResult): string {
    return runReportSync(formatJUnitReport(testResult));
  }
}
