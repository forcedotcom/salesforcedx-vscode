/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TestResult } from '../tests/apiTypes';

const stringifyNumberArrayChunks = function* (values: number[]): Generator<string> {
  yield '[';
  for (let index = 0; index < values.length; index += 1000) {
    if (index > 0) yield ',';
    yield JSON.stringify(values.slice(index, index + 1000)).slice(1, -1);
  }
  yield ']';
};

export interface TestResultStringifyOptions {
  includeSetup?: boolean;
}

/** Streams compact TestResult JSON while chunking potentially large coverage arrays. */
export const stringifyTestResultChunks = function* (
  testResult: TestResult,
  options: TestResultStringifyOptions = {}
): Generator<string> {
  yield `{"summary":${JSON.stringify(testResult.summary)},"tests":[`;
  for (const [index, test] of testResult.tests.entries()) {
    if (index > 0) yield ',';
    const { perClassCoverage, ...testRest } = test;
    yield JSON.stringify(testRest).slice(0, -1);
    if (perClassCoverage) {
      yield ',"perClassCoverage":[';
      for (const [coverageIndex, coverage] of perClassCoverage.entries()) {
        if (coverageIndex > 0) yield ',';
        const { coverage: lineCoverage, ...coverageRest } = coverage;
        yield `${JSON.stringify(coverageRest).slice(0, -1)},"coverage":${JSON.stringify(lineCoverage)}}`;
      }
      yield ']';
    }
    yield '}';
  }
  yield ']';

  if (options.includeSetup && testResult.setup !== undefined) {
    yield ',"setup":[';
    for (const [index, setup] of testResult.setup.entries()) {
      if (index > 0) yield ',';
      yield JSON.stringify(setup);
    }
    yield ']';
  }

  if (testResult.codecoverage) {
    yield ',"codecoverage":[';
    for (const [index, coverage] of testResult.codecoverage.entries()) {
      if (index > 0) yield ',';
      const { coveredLines, uncoveredLines, ...coverageRest } = coverage;
      yield JSON.stringify(coverageRest).slice(0, -1);
      yield ',"coveredLines":';
      yield* stringifyNumberArrayChunks(coveredLines);
      yield ',"uncoveredLines":';
      yield* stringifyNumberArrayChunks(uncoveredLines);
      yield '}';
    }
    yield ']';
  }

  yield '}';
};
