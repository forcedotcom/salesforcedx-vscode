/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { TestResultSchema as EffectTestResultSchema } from '../../src/effect/testSchemas';
import { transformTestResult } from '../../src/effect/testResults';
import { TestResultSchema } from '../../src/tests/types';
import { flowTestResultData, syncResult } from '../testData';

describe('test result schemas', () => {
  it.each([
    syncResult,
    { ...flowTestResultData, summary: { ...flowTestResultData.summary, username: 'test@example.com' } }
  ])('preserves the Promise result contract in the Effect API', result => {
    expect(Schema.decodeUnknownSync(EffectTestResultSchema)(result)).toEqual(
      Schema.decodeUnknownSync(TestResultSchema)(result)
    );
  });

  it('separates setup methods without dropping nullable result fields', () => {
    const result = transformTestResult({
      ...syncResult,
      summary: { ...syncResult.summary, testSetupTimeInMs: 8 },
      tests: [
        { ...syncResult.tests[0], isTestSetup: true },
        { ...syncResult.tests[0], stackTrace: null, message: null }
      ]
    });
    expect(result.summary.testTotalTimeInMs).toBe(syncResult.summary.testExecutionTimeInMs + 8);
    expect(result.tests).toEqual([{ ...syncResult.tests[0], stackTrace: null, message: null }]);
    expect(result.setup).toEqual([
      expect.objectContaining({
        methodName: syncResult.tests[0].methodName,
        testSetupTime: syncResult.tests[0].runTime
      })
    ]);
  });
});
