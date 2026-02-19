/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SelectCountImpl } from '../../../../../src/soql-model/model/impl/selectCountImpl';

describe('SelectCountImpl should', () => {
  it('return "SELECT COUNT()" for toSoqlSyntax()', () => {
    const expected = 'SELECT COUNT()';
    const actual = new SelectCountImpl().toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
