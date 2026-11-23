/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassId, SalesforceId, TestRunId, TraceFlagEntityId, UserId } from '../../src/schemas/salesforceId';
import { DebugLevelId, TraceFlagId } from '../../src/effect/schema/salesforceId';

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
    expect(Schema.is(UserId)('7tfxx0000000001')).toBe(false);
  });

  it('accepts only User, ApexClass, or ApexTrigger IDs as trace-flag entities', () => {
    expect(Schema.is(TraceFlagEntityId)('005xx0000000001')).toBe(true);
    expect(Schema.is(TraceFlagEntityId)('01p2M00000O6tXZQAZ')).toBe(true);
    expect(Schema.is(TraceFlagEntityId)('01q2M00000O6tXZQAZ')).toBe(true);
    expect(Schema.is(TraceFlagEntityId)('001xx0000000001')).toBe(false);
  });

  it('accepts only IDs with the DebugLevel prefix', () => {
    expect(Schema.is(DebugLevelId)('7dlxx0000000001')).toBe(true);
    expect(Schema.is(DebugLevelId)('7tfxx0000000001')).toBe(false);
  });

  it('accepts only IDs with the TraceFlag prefix', () => {
    expect(Schema.is(TraceFlagId)('7tfxx0000000001')).toBe(true);
    expect(Schema.is(TraceFlagId)('7dlxx0000000001')).toBe(false);
  });

  it('accepts only IDs with the test run prefix', () => {
    expect(Schema.is(TestRunId)('707xx0000AGQ3jbQQD')).toBe(true);
    expect(Schema.is(TestRunId)('01p2M00000O6tXZQAZ')).toBe(false);
  });
});
