/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TestResult } from '../tests/types';
import { buildTapDiagnostics } from './buildTapDiagnostics';

export const buildTapResults = (testResult: TestResult, lineEnding = '\n') =>
  testResult.tests.map((test, index) => ({
    testNumber: index + 1,
    description: test.fullName,
    diagnostics: buildTapDiagnostics(test, lineEnding),
    outcome: test.outcome === 'Pass' ? 'ok' : 'not ok'
  }));

export const formatTap = (testResult: TestResult, epilog?: string[], lineEnding = '\n'): string =>
  formatTapResults(buildTapResults(testResult, lineEnding), epilog, lineEnding);

export const formatTapResults = (
  results: ReturnType<typeof buildTapResults>,
  epilog?: string[],
  lineEnding = '\n'
): string =>
  `${[
    `1..${results.length}`,
    ...results.flatMap(test => [
      `${test.outcome} ${test.testNumber} ${test.description}`,
      ...test.diagnostics.map(line => `# ${line}`)
    ]),
    ...(epilog?.map(line => `# ${line}`) ?? [])
  ]
    .map(line => line.replaceAll(/\r\n|\r|\n/g, lineEnding))
    .join(lineEnding)}${lineEnding}`;
