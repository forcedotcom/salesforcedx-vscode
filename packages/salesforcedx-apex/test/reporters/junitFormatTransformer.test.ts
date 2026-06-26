/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JUnitFormatTransformer } from '../../src';
import { pipeline, Writable } from 'node:stream';
import { getTestData, junitSetup, setupResult } from './testResults';

const { testResults, junitResult, junitSuccess, junitCodeCov, junitMissingVal, successResult } = getTestData();

describe('JUnitFormatTransformer', () => {
  const runPipeline = (reporter: JUnitFormatTransformer): Promise<string> =>
    new Promise((resolve, reject) => {
      let result = '';
      const writable = new Writable({
        write(chunk, encoding, done) {
          result += chunk;
          done();
        }
      });
      writable.on('finish', () => resolve(result));
      pipeline(reporter, writable, err => {
        if (err) {
          reject(err);
        }
      });
    });

  it('should format test results with failures', async () => {
    const result = await runPipeline(new JUnitFormatTransformer(testResults));
    expect(result).not.toHaveLength(0);
    expect(result).toEqual(junitResult);
    expect(result).toContain('</failure>');
  });

  it('should format tests with 0 failures', async () => {
    const result = await runPipeline(new JUnitFormatTransformer(successResult));
    expect(result).not.toHaveLength(0);
    expect(result).toEqual(junitSuccess);
    expect(result).not.toContain('</failure>');
  });

  it('should format tests with setup methods', async () => {
    const result = await runPipeline(new JUnitFormatTransformer(setupResult));
    expect(result).not.toHaveLength(0);
    expect(result).toEqual(junitSetup);
    expect(result).not.toContain('</failure>');
  });

  it('should format test results with undefined or empty values', async () => {
    successResult.summary.testRunId = '';
    successResult.summary.userId = undefined as unknown as string;
    const result = await runPipeline(new JUnitFormatTransformer(successResult));
    expect(result).not.toHaveLength(0);
    expect(result).toEqual(junitMissingVal);
    expect(result).not.toContain('testRunId');
    expect(result).not.toContain('userId');
  });

  it('should format test results with code coverage', async () => {
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
    const result = await runPipeline(new JUnitFormatTransformer(successResult));
    expect(result).not.toHaveLength(0);
    expect(result).toEqual(junitCodeCov);
    expect(result).toContain('orgWideCoverage');
  });
});
