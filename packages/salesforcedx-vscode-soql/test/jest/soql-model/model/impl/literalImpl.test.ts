/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LiteralImpl } from '../../../../../src/soql-model/model/impl/literalImpl';

describe('LiteralImpl should', () => {
  it('store the literal type and value', () => {
    const expected = { value: 'TRUE' };
    const actual = new LiteralImpl('TRUE');
    expect(actual).toEqual(expected);
  });
  it('return the value of the literal for toSoqlSyntax()', () => {
    const expected = 'TRUE';
    const actual = new LiteralImpl('TRUE').toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
