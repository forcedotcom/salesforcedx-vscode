/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type TestResult } from '../tests/types';
import { buildTapDiagnostics } from './buildTapDiagnostics';

const formatComments = (comments: string[]): string => comments.map(comment => `# ${comment}\n`).join('');

export const buildTapResults = (testResult: TestResult) =>
  testResult.tests.map((test, index) => ({
    testNumber: index + 1,
    description: test.fullName,
    diagnostics: buildTapDiagnostics(test),
    outcome: test.outcome === 'Pass' ? 'ok' : 'not ok'
  }));

export const formatTapResults = (results: ReturnType<typeof buildTapResults>): string =>
  results
    .map(test => `${test.outcome} ${test.testNumber} ${test.description}\n${formatComments(test.diagnostics)}`)
    .join('');

export const formatTap = (results: ReturnType<typeof buildTapResults>, epilog: string[] = []): string =>
  `1..${results.length}\n${formatTapResults(results)}${formatComments(epilog)}`;
