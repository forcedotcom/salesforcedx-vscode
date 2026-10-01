/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldRefImpl } from '../../../../src/model/impl/fieldRefImpl';
import { OrderByExpressionImpl } from '../../../../src/model/impl/orderByExpressionImpl';
import { NullsOrder, Order } from '../../../../src/model/model';

describe('OrderByExpressionImpl should', () => {
  it('store order by expression components', () => {
    const expected = {
      field: { kind: 'fieldRef', fieldName: 'shattered' },
      order: 'ASC',
      nullsOrder: 'NULLS FIRST'
    };
    const actual = new OrderByExpressionImpl(new FieldRefImpl('shattered'), Order.Ascending, NullsOrder.First);
    expect(actual).toEqual(expected);
  });
  it('return field, order, and nulls order separated by spaces for toSoqlSyntax()', () => {
    const expected = 'shattered ASC NULLS FIRST';
    const actual = new OrderByExpressionImpl(
      new FieldRefImpl('shattered'),
      Order.Ascending,
      NullsOrder.First
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
