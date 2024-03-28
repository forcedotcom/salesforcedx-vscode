/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JUnitFormatTransformer } from '../../src';
import { expect } from 'chai';
import { pipeline, Writable } from 'node:stream';
import { getTestData } from './testResults';
import { fail } from 'assert';

const {
  testResults,
  junitResult,
  junitSuccess,
  junitCodeCov,
  junitMissingVal,
  successResult
} = getTestData();

describe('JUnitFormatTransformer', () => {
  const createWritableAndPipeline = (
    reporter: JUnitFormatTransformer,
    callback: (result: string) => void
  ): void => {
    let result = '';

    const writable = new Writable({
      write(chunk, encoding, done) {
        result += chunk;
        done();
      }
    });

    writable.on('finish', () => callback(result));

    pipeline(reporter, writable, (err) => {
      if (err) {
        console.error('Pipeline failed', err);
        fail(err);
      }
    });
  };

  it('should format test results with failures', () => {
    const reporter = new JUnitFormatTransformer(testResults);
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.eql(junitResult);
      expect(result).to.contain('</failure>');
    });
  });

  it('should format tests with 0 failures', () => {
    const reporter = new JUnitFormatTransformer(successResult);
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.eql(junitSuccess);
      expect(result).to.not.contain('</failure>');
    });
  });

  it('should format test results with undefined or empty values', async () => {
    successResult.summary.testRunId = '';
    successResult.summary.userId = undefined;
    const reporter = new JUnitFormatTransformer(successResult);
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.eql(junitMissingVal);
      expect(result).to.not.contain('testRunId');
      expect(result).to.not.contain('userId');
    });
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
    const reporter = new JUnitFormatTransformer(successResult);
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.eql(junitCodeCov);
      expect(result).to.contain('orgWideCoverage');
    });
  });
});
