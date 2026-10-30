/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import {
  ApexClassId,
  ApexLogId,
  ApexTestQueueItemId,
  ApexTestResultId,
  ApexTriggerId,
  FlowTestResultId,
  OrgIdString,
  SalesforceId,
  TestRunId,
  TestRunIdString,
  UserId,
  UserIdString
} from '../../src/schemas/salesforceId';

describe('Salesforce ID schemas', () => {
  it('accepts 15- and 18-character alphanumeric Salesforce IDs', () => {
    expect(Schema.is(SalesforceId)('001xx0000000001')).toBe(true);
    expect(Schema.is(SalesforceId)('001xx0000000001AAA')).toBe(true);
    expect(Schema.is(SalesforceId)('001xx000000000')).toBe(false);
    expect(Schema.is(SalesforceId)('001xx000000000!')).toBe(false);
  });

  it('accepts only IDs with the ApexClass prefix', () => {
    expect(Schema.is(ApexClassId)('01p2M00000O6tXZQAZ')).toBe(true);
    expect(Schema.is(ApexClassId)('707xx0000AGQ3jbQQD')).toBe(false);
  });

  it('accepts only IDs with the User prefix', () => {
    expect(Schema.is(UserId)('005xx0000000001')).toBe(true);
    expect(Schema.is(UserIdString)('005xx0000000001')).toBe(true);
    expect(Schema.is(UserId)('01p2M00000O6tXZQAZ')).toBe(false);
    expect(Schema.is(UserId)('005xx000000')).toBe(false);
  });

  it('accepts only IDs with the Organization prefix', () => {
    expect(Schema.is(OrgIdString)('00Dxx0000000001AAA')).toBe(true);
    expect(Schema.is(OrgIdString)('005xx0000000001AAA')).toBe(false);
  });

  it('accepts only IDs with the ApexLog prefix', () => {
    expect(Schema.is(ApexLogId)('07Lxx00000cxy6YUAQ')).toBe(true);
    expect(Schema.is(ApexLogId)('07Lxx00000cxy6Y')).toBe(true);
    expect(Schema.is(ApexLogId)('005xx0000000001AAA')).toBe(false);
    expect(Schema.is(ApexLogId)('07Linvalid')).toBe(false);
  });

  it('accepts only IDs with the ApexTrigger prefix', () => {
    expect(Schema.is(ApexTriggerId)('01q000000000001AAA')).toBe(true);
    expect(Schema.is(ApexTriggerId)('01q000000000001')).toBe(true);
    expect(Schema.is(ApexTriggerId)('01p000000000001AAA')).toBe(false);
    expect(Schema.is(ApexTriggerId)('01qinvalid')).toBe(false);
  });

  it('accepts only IDs with the test run prefix', () => {
    expect(Schema.is(TestRunId)('707xx0000AGQ3jbQQD')).toBe(true);
    expect(Schema.is(TestRunIdString)('707xx0000AGQ3jbQQD')).toBe(true);
    expect(Schema.is(TestRunId)('01p2M00000O6tXZQAZ')).toBe(false);
  });

  it('validates Apex and Flow test result IDs separately', () => {
    expect(Schema.is(ApexTestResultId)('07Mxx00000F2Xx6UAF')).toBe(true);
    expect(Schema.is(ApexTestResultId)('2hUxx0000000001AAA')).toBe(false);
    expect(Schema.is(FlowTestResultId)('2hUxx0000000001AAA')).toBe(true);
    expect(Schema.is(FlowTestResultId)('07Mxx00000F2Xx6UAF')).toBe(false);
  });

  it('accepts only IDs with the Apex test queue item prefix', () => {
    expect(Schema.is(ApexTestQueueItemId)('7092M000000Vt94QAC')).toBe(true);
    expect(Schema.is(ApexTestQueueItemId)('707xx0000AGQ3jbQQD')).toBe(false);
  });
});
