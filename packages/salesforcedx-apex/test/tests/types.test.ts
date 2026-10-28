/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import {
  ApexTestResultDataSchema,
  ApexTestRunResultStatusSchema,
  TestCategorySchema,
  TestResultSchema,
  TestResultSummarySchema
} from '../../src/tests/types';
import { flowTestResultData, syncResult } from '../testData';

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
