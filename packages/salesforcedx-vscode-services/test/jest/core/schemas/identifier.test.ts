/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { IdentifierSchema, LowercaseFirstIdentifierSchema } from '../../../../src/core/schemas/identifier';

describe('identifier schemas', () => {
  const isIdentifier = Schema.is(IdentifierSchema);
  const isLowercaseFirstIdentifier = Schema.is(LowercaseFirstIdentifierSchema);

  it.each(['A', 'abc', 'A1_b2', 'a_B'])('accepts identifier %p', value => {
    expect(isIdentifier(value)).toBe(true);
  });

  it.each(['', '1abc', '_abc', 'a b', 'a-b', ' a', 'a!'])('rejects identifier %p', value => {
    expect(isIdentifier(value)).toBe(false);
  });

  it.each(['a', 'abc', 'a1_B'])('accepts lowercase-first identifier %p', value => {
    expect(isLowercaseFirstIdentifier(value)).toBe(true);
  });

  it.each(['A', 'Abc', '1abc', '_abc'])('rejects lowercase-first identifier %p', value => {
    expect(isLowercaseFirstIdentifier(value)).toBe(false);
  });
});
