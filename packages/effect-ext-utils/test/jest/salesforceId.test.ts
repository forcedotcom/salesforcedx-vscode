/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { SalesforceIdSchema } from '../../src/salesforceId';

describe('SalesforceIdSchema', () => {
  it.each(['001000000000000', '001000000000000AAA'])('accepts Salesforce ID %p', value => {
    expect(Schema.is(SalesforceIdSchema)(value)).toBe(true);
  });

  it.each(['', '00100000000000', '001000000000000A', '001000000000000AA!', '00100000000000_'])(
    'rejects Salesforce ID %p',
    value => {
      expect(Schema.is(SalesforceIdSchema)(value)).toBe(false);
    }
  );
});
