/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TapFormatTransformer } from '../../src';
import { testResults } from './testResults';
import { Writable, pipeline } from 'node:stream';

const runPipeline = (reporter: TapFormatTransformer): Promise<string> =>
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

describe('TapFormatTransformer Tests', () => {
  it('should format test results', async () => {
    const result = await runPipeline(new TapFormatTransformer(testResults));
    expect(result).not.toHaveLength(0);
    expect(result).toContain('1..16');
    expect(result).toContain('ok 1 AccountServiceTest.should_create_account');
    expect(result).toContain(
      'not ok 6 AnimalLocatorTest.testMissingAnimal\n# System.AssertException: Assertion Failed: Should not have found an animal: Expected: FooBar, Actual:\n# Class.AnimalLocatorTest.testMissingAnimal: line 22, column 1\n'
    );
  });

  it('should format test results and epilog', async () => {
    const result = await runPipeline(new TapFormatTransformer(testResults, ['One', 'Two', 'Three']));
    expect(result).not.toHaveLength(0);
    expect(result).toContain('1..16');
    expect(result).toContain('ok 1 AccountServiceTest.should_create_account');
    expect(result).toMatch(new RegExp('ok 16 DailyLeadProcessorTest.testLeadProcessing\n# One\n# Two\n# Three\n$'));
  });
});
