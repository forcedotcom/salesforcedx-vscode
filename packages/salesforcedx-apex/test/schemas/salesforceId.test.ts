/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexClassId, SalesforceId, TestRunId } from '../../src/schemas/salesforceId';

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

  it('accepts only IDs with the test run prefix', () => {
    expect(Schema.is(TestRunId)('707xx0000AGQ3jbQQD')).toBe(true);
    expect(Schema.is(TestRunId)('01p2M00000O6tXZQAZ')).toBe(false);
  });
});
