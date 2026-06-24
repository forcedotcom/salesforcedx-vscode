/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { TapFormatTransformer } from '../../src';
import { testResults } from './testResults';
import { Writable, pipeline } from 'node:stream';
import { fail } from 'assert';

function createWritableAndPipeline(
  reporter: TapFormatTransformer,
  callback: (result: string) => void
): void {
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
}

describe('TapFormatTransformer Tests', () => {
  let reporter: TapFormatTransformer;

  beforeEach(async () => {
    reporter = new TapFormatTransformer(testResults);
  });

  it('should format test results', () => {
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.contain('1..16');
      expect(result).to.contain(
        'ok 1 AccountServiceTest.should_create_account'
      );
      expect(result).to.contain(
        'not ok 6 AnimalLocatorTest.testMissingAnimal\n# System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:\n# Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1\n'
      );
    });
  });

  it('should format test results and epilog', () => {
    reporter = new TapFormatTransformer(testResults, ['One', 'Two', 'Three']);
    createWritableAndPipeline(reporter, (result) => {
      expect(result).to.not.be.empty;
      expect(result).to.contain('1..16');
      expect(result).to.contain(
        'ok 1 AccountServiceTest.should_create_account'
      );
      expect(result).to.match(
        new RegExp(
          'ok 16 DailyLeadProcessorTest.testLeadProcessing\n# One\n# Two\n# Three\n$'
        )
      );
    });
  });
});
