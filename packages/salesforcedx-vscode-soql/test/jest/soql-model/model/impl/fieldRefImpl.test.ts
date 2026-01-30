/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldRefImpl } from '../../../../../src/soql-model/model/impl/fieldRefImpl';

describe('FieldRefImpl should', () => {
  it('store a string field name as fieldName', () => {
    const expected = { fieldName: 'charlie' };
    const actual = new FieldRefImpl(expected.fieldName);
    expect(actual).toEqual(expected);
  });
  it('return field name for toSoqlSyntax()', () => {
    const expected = 'rolling';
    const actual = new FieldRefImpl('rolling').toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
