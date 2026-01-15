/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';

describe('OrderByImpl should', () => {
  it('store ORDER BY expressions', () => {
    const expected = {
      orderByExpressions: [{ field: { fieldName: 'some' } }, { field: { fieldName: 'girls' } }],
    };
    const actual = new Impl.OrderByImpl([
      new Impl.OrderByExpressionImpl(new Impl.FieldRefImpl('some')),
      new Impl.OrderByExpressionImpl(new Impl.FieldRefImpl('girls')),
    ]);
    expect(actual).toEqual(expected);
  });
  it('return "ORDER BY " for empty list of expressions for toSoqlSyntax()', () => {
    const expected = 'ORDER BY ';
    const actual = new Impl.OrderByImpl([]).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
  it('return comma separated list of fields for toSoqlSyntax()', () => {
    const expected = 'ORDER BY some, girls';
    const actual = new Impl.OrderByImpl([
      new Impl.OrderByExpressionImpl(new Impl.FieldRefImpl('some')),
      new Impl.OrderByExpressionImpl(new Impl.FieldRefImpl('girls')),
    ]).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
