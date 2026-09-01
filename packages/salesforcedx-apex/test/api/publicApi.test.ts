/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as publicApi from '../../src';
import * as packageJson from '../../package.json';

describe('@salesforce/apex-node public API', () => {
  it('exports the established runtime symbols', () => {
    expect(Object.keys(publicApi).sort()).toEqual([
      'ApexTestResultOutcome',
      'ApexTestRunResultStatus',
      'CancellationTokenSource',
      'CoverageReporter',
      'DefaultReportOptions',
      'DefaultWatermarks',
      'ExecuteService',
      'HumanReporter',
      'JUnitFormatTransformer',
      'JUnitReporter',
      'LogService',
      'MarkdownTextFormatTransformer',
      'ResultFormat',
      'Table',
      'TapFormatTransformer',
      'TapReporter',
      'TestLevel',
      'TestService',
      'writeAsyncResultsToFile',
      'writeResultFiles'
    ]);
  });

  it('restricts consumers to the established package entry points', () => {
    expect(packageJson.exports).toEqual({
      '.': {
        types: './out/src/index.d.ts',
        default: './out/src/index.js'
      },
      './lib/src/tests/types.js': {
        types: './out/src/tests/types.d.ts',
        default: './out/src/tests/types.js'
      }
    });
  });
});
