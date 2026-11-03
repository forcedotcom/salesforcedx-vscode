/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { TestResult } from '../tests/types';
import { runReportSync } from '../effect/errors';
import { formatTapReport } from '../effect/reporters';

/** Compatibility adapter for the Effect-native TAP reporter. */
export class TapReporter {
  public format(testResult: TestResult, epilog?: string[]): string {
    return runReportSync(formatTapReport(testResult, epilog));
  }
}
