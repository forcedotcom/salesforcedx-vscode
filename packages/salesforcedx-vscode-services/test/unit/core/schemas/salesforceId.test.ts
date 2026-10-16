/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { OrgId, SalesforceId } from '../../../../src/core/schemas/salesforceId';

describe('SalesforceId', () => {
  it.each(['001000000000000', '001000000000000AAA'])('accepts %p', value => {
    expect(Schema.is(SalesforceId)(value)).toBe(true);
  });

  it.each(['', 'org-one', '00100000000000', '001000000000000A', '001000000000000AA!', '00100000000000_'])(
    'rejects %p',
    value => {
      expect(Schema.is(SalesforceId)(value)).toBe(false);
    }
  );
});

describe('OrgId', () => {
  it.each(['00D000000000001', '00Dxx0000001gPLEAY'])('accepts %p', value => {
    expect(Schema.is(OrgId)(value)).toBe(true);
  });

  it.each(['', 'org-one', 'startup-org', '001000000000000', '00D-expected', '00Dxx'])('rejects %p', value => {
    expect(Schema.is(OrgId)(value)).toBe(false);
  });
});
