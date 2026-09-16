/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isValidOrgAlias, validateAliasInput } from '../../../src/util/orgAlias';

describe('isValidOrgAlias', () => {
  it.each(['MyOrg', 'org123', 'my org', 'snake_case', 'a b c', 'Org_1 Org_2', 'my-org', 'my-scratch-org', 'a-b c-d'])(
    'accepts %p',
    value => {
      expect(isValidOrgAlias(value)).toBe(true);
    }
  );

  // 'rm -rf' is not rejected here: hyphens are allowed, so it's a valid (if odd) alias.
  it.each(['my;org', 'a|b', 'x&y', 'cost$', '`x`', '"q"', '$(x)', '', ' leading'])('rejects %p', value => {
    expect(isValidOrgAlias(value)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidOrgAlias(undefined)).toBe(false);
  });
});

describe('validateAliasInput', () => {
  it.each(['MyOrg', 'org123', 'my org', 'snake_case', 'my-org', 'my-scratch-org', ''])(
    'returns undefined (valid) for %p',
    value => {
      expect(validateAliasInput(value)).toBeUndefined();
    }
  );

  it.each(['my;org', 'a|b', 'x&y', 'cost$', '`x`', '$(x)'])('returns an error message for %p', value => {
    expect(validateAliasInput(value)).toBeTruthy();
  });
});
