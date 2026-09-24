/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { LetterStartNameSchema } from '../../src/letterStartName';

describe('letter-start name schemas', () => {
  it.each(['A', 'abc', 'A1_b2', 'a_B'])('accepts letter-start name %p', value => {
    expect(Schema.is(LetterStartNameSchema)(value)).toBe(true);
  });

  it.each(['', '1abc', '_abc', 'a b', 'a-b', ' a', 'a!'])('rejects letter-start name %p', value => {
    expect(Schema.is(LetterStartNameSchema)(value)).toBe(false);
  });
});
