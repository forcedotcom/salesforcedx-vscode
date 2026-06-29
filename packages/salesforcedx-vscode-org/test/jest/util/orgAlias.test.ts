/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isAlphaNumSpaceString } from '../../../src/util/orgAlias';

describe('isAlphaNumSpaceString', () => {
  it.each(['MyOrg', 'org123', 'my org', 'snake_case', 'a b c', 'Org_1 Org_2'])('accepts %p', value => {
    expect(isAlphaNumSpaceString(value)).toBe(true);
  });

  it.each(['my;org', 'a|b', 'x&y', 'cost$', 'rm -rf', '`x`', '"q"', '$(x)', ''])('rejects %p', value => {
    expect(isAlphaNumSpaceString(value)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isAlphaNumSpaceString(undefined)).toBe(false);
  });
});
