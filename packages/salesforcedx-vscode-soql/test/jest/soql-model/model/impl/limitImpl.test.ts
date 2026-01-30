/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LimitImpl } from '../../../../../src/soql-model/model/impl/limitImpl';

describe('LimitImpl should', () => {
  it('store limit value as a number', () => {
    const expected = { limit: 5 };
    const actual = new LimitImpl(5);
    expect(actual).toEqual(expected);
  });
  it('return "LIMIT <value>" for toSoqlSyntax()', () => {
    const expected = 'LIMIT 5';
    const actual = new LimitImpl(5).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
