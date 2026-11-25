/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { formatHuman } from '../../src';
import {
  successResult,
  testResults,
  coverageResult,
  coverageFailResult,
  setupResult,
  testResultsWithCategory,
  coverageResultWithCategory,
  coverageFailResultWithCategory
} from './testResults';
import { normalizeFormatterOutput } from './formattingSnapshot';

const expectSnapshot = (output: string): void => {
  expect(normalizeFormatterOutput(output)).toMatchSnapshot();
};

describe('Human Formatting Tests', () => {
  it('formats test failures', () => expectSnapshot(formatHuman(testResults, false)));

  it('formats passing tests', () => expectSnapshot(formatHuman(successResult, false)));

  it('formats code coverage', () => expectSnapshot(formatHuman(coverageResult, false)));

  it('formats setup methods', () => expectSnapshot(formatHuman(setupResult, false)));

  it('omits setup details when there are no setup methods', () => expectSnapshot(formatHuman(successResult, false)));

  it('omits setup details in concise mode', () => expectSnapshot(formatHuman(setupResult, false, true)));

  it('formats detailed coverage', () => expectSnapshot(formatHuman(coverageResult, true)));

  it('formats failures with detailed coverage', () => expectSnapshot(formatHuman(coverageFailResult, true)));

  it('omits passing tests in concise mode', () => expectSnapshot(formatHuman(testResults, false, true)));

  it('omits overall coverage in concise mode', () => expectSnapshot(formatHuman(coverageFailResult, true, true)));

  // Tests for showCategory functionality
  it('shows test categories when enabled', () =>
    expectSnapshot(formatHuman(testResultsWithCategory, false, false, true)));

  it('omits test categories when disabled', () =>
    expectSnapshot(formatHuman(testResultsWithCategory, false, false, false)));

  it('shows categories in detailed coverage when enabled', () =>
    expectSnapshot(formatHuman(coverageResultWithCategory, true, false, true)));

  it('omits categories in detailed coverage when disabled', () =>
    expectSnapshot(formatHuman(coverageResultWithCategory, true, false, false)));

  it('shows categories in concise mode when enabled', () =>
    expectSnapshot(formatHuman(testResultsWithCategory, false, true, true)));

  it('shows categories in concise detailed coverage', () =>
    expectSnapshot(formatHuman(coverageFailResultWithCategory, true, true, true)));
});
