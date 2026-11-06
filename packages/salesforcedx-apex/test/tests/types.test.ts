/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { TestResultSchema as EffectTestResultSchema } from '../../src/effect';
import { transformTestResult } from '../../src/effect/testResults';
import {
  ApexTestSetupDataSchema,
  ApexTestResultDataSchema,
  ApexTestRunResultStatusSchema,
  TestCategorySchema,
  TestResultSchema,
  TestResultSummarySchema,
  type TestResultRaw
} from '../../src/tests/types';
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
        {
          ...syncResult.tests[0],
          id: '07Mxx00000F2Xx6UAF',
          asyncApexJobId: '707xx0000AGQ3jbQQD',
          isTestSetup: true
        },
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

describe('ApexTestResultDataSchema', () => {
  it('accepts sync test results without async-only IDs', () => {
    expect(Schema.is(TestResultSchema)(syncResult)).toBe(true);
    expect(syncResult.summary).not.toHaveProperty('testRunId');
    expect(Schema.is(ApexTestResultDataSchema)(syncResult.tests[0])).toBe(true);
    expect(syncResult.tests[0]).not.toHaveProperty('id');
    expect(syncResult.tests[0]).not.toHaveProperty('queueItemId');
    expect(syncResult.tests[0]).not.toHaveProperty('asyncApexJobId');
  });

  it('validates organization, user, and test run ID prefixes', () => {
    const validSummary = { ...syncResult.summary, testRunId: '707000000000001AAA' };

    expect(Schema.is(TestResultSummarySchema)(validSummary)).toBe(true);
    expect(Schema.is(TestResultSummarySchema)({ ...validSummary, orgId: '005xx0000000001AAA' })).toBe(false);
    expect(Schema.is(TestResultSummarySchema)({ ...validSummary, userId: '00Dxx0000000001AAA' })).toBe(false);
    expect(Schema.is(TestResultSummarySchema)({ ...validSummary, userId: undefined })).toBe(true);
    expect(Schema.is(TestResultSummarySchema)({ ...validSummary, userId: '' })).toBe(false);
    expect(Schema.is(TestResultSummarySchema)({ ...validSummary, testRunId: '7092M000000Vt94QAC' })).toBe(false);
    expect(Schema.is(TestResultSummarySchema)({ ...validSummary, testRunId: '' })).toBe(false);
  });

  it('accepts only Apex and Flow categories', () => {
    expect(Schema.is(TestCategorySchema)('Apex')).toBe(true);
    expect(Schema.is(TestCategorySchema)('Flow')).toBe(true);
    expect(Schema.is(TestCategorySchema)('Other')).toBe(false);
  });

  it('accepts only Apex test run statuses as summary outcomes', () => {
    expect(Schema.is(ApexTestRunResultStatusSchema)('Passed')).toBe(true);
    expect(Schema.is(ApexTestRunResultStatusSchema)('Aborted')).toBe(true);
    expect(Schema.is(ApexTestRunResultStatusSchema)('Complete')).toBe(false);
    expect(Schema.is(TestResultSummarySchema)({ ...syncResult.summary, outcome: 'Unknown' })).toBe(false);
  });

  it('accepts Flow results without Apex-only IDs', () => {
    expect(Schema.is(ApexTestResultDataSchema)(flowTestResultData.tests[0])).toBe(true);
    expect(flowTestResultData.tests[0]).not.toHaveProperty('asyncApexJobId');
    expect(flowTestResultData.tests[0]).not.toHaveProperty('apexLogId');
    expect(flowTestResultData.tests[0].apexClass).not.toHaveProperty('id');
  });

  it('omits nullish optional setup fields', () => {
    const rawResult: TestResultRaw = {
      summary: syncResult.summary,
      tests: [
        {
          id: undefined,
          stackTrace: null,
          message: null,
          asyncApexJobId: undefined,
          methodName: 'setup_method',
          outcome: 'Pass',
          apexLogId: null,
          apexClass: {
            id: undefined,
            name: 'AccountServiceTest',
            namespacePrefix: null,
            fullName: 'AccountServiceTest'
          },
          runTime: 24,
          testTimestamp: undefined,
          fullName: 'AccountServiceTest.setup_method',
          diagnostic: undefined,
          isTestSetup: true
        }
      ]
    };
    const result = transformTestResult(rawResult);

    expect(result.setup).toEqual([
      {
        methodName: 'setup_method',
        apexClass: { name: 'AccountServiceTest', fullName: 'AccountServiceTest' },
        testSetupTime: 24,
        fullName: 'AccountServiceTest.setup_method'
      }
    ]);
    expect(Schema.is(ApexTestSetupDataSchema)(result.setup?.[0])).toBe(true);
  });

  it('rejects IDs with the wrong Salesforce object prefix', () => {
    expect(
      Schema.is(ApexTestResultDataSchema)({
        ...syncResult.tests[0],
        asyncApexJobId: '7092M000000Vt94QAC'
      })
    ).toBe(false);
    expect(
      Schema.is(ApexTestResultDataSchema)({
        ...flowTestResultData.tests[0],
        queueItemId: '707xx0000AGQ3jbQQD'
      })
    ).toBe(false);
    expect(
      Schema.is(ApexTestResultDataSchema)({
        ...flowTestResultData.tests[0],
        apexClass: { ...flowTestResultData.tests[0].apexClass, id: '7092M000000Vt94QAC' }
      })
    ).toBe(false);
  });
});
