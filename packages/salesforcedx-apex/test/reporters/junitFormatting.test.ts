/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { formatJUnit } from '../../src';
import { getTestData } from './testResults';
import { normalizeFormatterOutput } from './formattingSnapshot';

const { testResults, setupResult, successResult } = getTestData();
const expectSnapshot = (output: string): void => {
  expect(normalizeFormatterOutput(output)).toMatchSnapshot();
};

describe('JUnit Formatting Tests', () => {
  it('should format test results with failures', () => {
    expectSnapshot(formatJUnit(testResults));
  });

  it('should format tests with 0 failures', () => {
    expectSnapshot(formatJUnit(successResult));
  });

  it('should format tests with setup methods', () => {
    expectSnapshot(formatJUnit(setupResult));
  });

  it('should format test results with undefined or empty values', () => {
    successResult.summary.testRunId = undefined;
    successResult.summary.userId = undefined;

    expectSnapshot(formatJUnit(successResult));
  });

  it('should format test results with code coverage', () => {
    successResult.codecoverage = [
      {
        apexId: '001917xACG',
        name: 'ApexTestClass',
        type: 'ApexClass',
        numLinesCovered: 8,
        numLinesUncovered: 2,
        percentage: '12.5%',
        coveredLines: [1, 2, 3, 4, 5, 6, 7, 8],
        uncoveredLines: [9, 10]
      }
    ];
    successResult.summary.orgWideCoverage = '85%';
    expectSnapshot(formatJUnit(successResult));
  });
});
