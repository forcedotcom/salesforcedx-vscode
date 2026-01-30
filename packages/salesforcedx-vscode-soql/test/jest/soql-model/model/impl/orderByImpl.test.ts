/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldRefImpl } from '../../../../../src/soql-model/model/impl/fieldRefImpl';
import { OrderByExpressionImpl } from '../../../../../src/soql-model/model/impl/orderByExpressionImpl';
import { OrderByImpl } from '../../../../../src/soql-model/model/impl/orderByImpl';

describe('OrderByImpl should', () => {
  it('store ORDER BY expressions', () => {
    const expected = {
      orderByExpressions: [{ field: { fieldName: 'some' } }, { field: { fieldName: 'girls' } }],
    };
    const actual = new OrderByImpl([
      new OrderByExpressionImpl(new FieldRefImpl('some')),
      new OrderByExpressionImpl(new FieldRefImpl('girls')),
    ]);
    expect(actual).toEqual(expected);
  });
  it('return "ORDER BY " for empty list of expressions for toSoqlSyntax()', () => {
    const expected = 'ORDER BY ';
    const actual = new OrderByImpl([]).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
  it('return comma separated list of fields for toSoqlSyntax()', () => {
    const expected = 'ORDER BY some, girls';
    const actual = new OrderByImpl([
      new OrderByExpressionImpl(new FieldRefImpl('some')),
      new OrderByExpressionImpl(new FieldRefImpl('girls')),
    ]).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
