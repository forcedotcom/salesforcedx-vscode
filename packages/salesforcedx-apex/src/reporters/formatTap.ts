/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TestResult } from '../tests/types';
import * as Stream from 'effect/Stream';
import { buildTapDiagnostics } from './buildTapDiagnostics';

const buildTapResults = (testResult: TestResult, lineEnding = '\n') =>
  testResult.tests.map((test, index) => ({
    testNumber: index + 1,
    description: test.fullName,
    diagnostics: buildTapDiagnostics(test, lineEnding),
    outcome: test.outcome === 'Pass' ? 'ok' : 'not ok'
  }));

function* formatTapChunkIterable(
  results: ReturnType<typeof buildTapResults>,
  epilog: string[] | undefined,
  lineEnding: string
): Generator<string, void> {
  yield `1..${results.length}${lineEnding}`;
  for (const test of results) {
    yield `${`${test.outcome} ${test.testNumber} ${test.description}`.replaceAll(/\r\n|\r|\n/g, lineEnding)}${lineEnding}`;
    for (const diagnostic of test.diagnostics) {
      yield `${`# ${diagnostic}`.replaceAll(/\r\n|\r|\n/g, lineEnding)}${lineEnding}`;
    }
  }
  for (const line of epilog ?? []) {
    yield `${`# ${line}`.replaceAll(/\r\n|\r|\n/g, lineEnding)}${lineEnding}`;
  }
}

export const formatTapChunks = (testResult: TestResult, epilog?: string[], lineEnding = '\n'): Stream.Stream<string> =>
  Stream.fromIterable(formatTapChunkIterable(buildTapResults(testResult, lineEnding), epilog, lineEnding));
