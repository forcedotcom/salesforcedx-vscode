/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type TestResult } from '../tests/apiTypes.js';
import { buildTapDiagnostics } from './buildTapDiagnostics.js';

const formatComments = (comments: string[]): string => comments.map(comment => `# ${comment}\n`).join('');

const buildTapResults = (testResult: TestResult) =>
  testResult.tests.map((test, index) => ({
    testNumber: index + 1,
    description: test.fullName,
    diagnostics: buildTapDiagnostics(test),
    outcome: test.outcome === 'Pass' ? 'ok' : 'not ok'
  }));

const formatTapResults = (results: ReturnType<typeof buildTapResults>): string =>
  results
    .map(test => `${test.outcome} ${test.testNumber} ${test.description}\n${formatComments(test.diagnostics)}`)
    .join('');

export const formatTap = (testResult: TestResult, epilog: string[] = []): string => {
  const results = buildTapResults(testResult);
  return `1..${results.length}\n${formatTapResults(results)}${formatComments(epilog)}`;
};
