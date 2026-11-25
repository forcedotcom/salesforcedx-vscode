/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { nls } from '../../../src/messages';
import { OrgAlias, validateAliasInput, validateRequiredAliasInput } from '../../../src/util/orgAlias';

describe('OrgAlias', () => {
  it.each(['MyOrg', 'org123', 'my org', 'snake_case', 'a b c', 'Org_1 Org_2', 'my-org', 'my-scratch-org', 'a-b c-d'])(
    'accepts %p',
    value => {
      expect(Schema.is(OrgAlias)(value)).toBe(true);
    }
  );

  // 'rm -rf' is not rejected here: hyphens are allowed, so it's a valid (if odd) alias.
  it.each(['my;org', 'a|b', 'x&y', 'cost$', '`x`', '"q"', '$(x)', '', ' leading'])('rejects %p', value => {
    expect(Schema.is(OrgAlias)(value)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(Schema.is(OrgAlias)(undefined)).toBe(false);
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
    expect(validateAliasInput(value)).toBe(nls.localize('error_invalid_org_alias'));
  });
});

describe('validateRequiredAliasInput', () => {
  it.each(['', '   ', 'my;org', ' leading'])('returns the schema message for %p', value => {
    expect(validateRequiredAliasInput(value)).toBe(nls.localize('error_invalid_org_alias'));
  });

  it.each(['my-org', 'my org_1', 'org123'])('accepts %p', value => {
    expect(validateRequiredAliasInput(value)).toBeUndefined();
  });
});
