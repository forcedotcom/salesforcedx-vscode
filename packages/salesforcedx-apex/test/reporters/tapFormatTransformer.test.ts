/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TapFormatTransformer } from '../../src/reporters/tapFormatTransform';
import { formatTap } from '../../src/reporters/tapFormatting';
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
    expect(result).toBe(formatTap(testResults));
  });

  it('should format test results and epilog', async () => {
    const result = await runPipeline(new TapFormatTransformer(testResults, ['One', 'Two', 'Three']));
    expect(result).toBe(formatTap(testResults, ['One', 'Two', 'Three']));
  });
});
