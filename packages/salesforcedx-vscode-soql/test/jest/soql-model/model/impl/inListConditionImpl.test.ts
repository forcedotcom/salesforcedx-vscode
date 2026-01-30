/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldRefImpl } from '../../../../../src/soql-model/model/impl/fieldRefImpl';
import { InListConditionImpl } from '../../../../../src/soql-model/model/impl/inListConditionImpl';
import { LiteralImpl } from '../../../../../src/soql-model/model/impl/literalImpl';
import { ConditionOperator } from '../../../../../src/soql-model/model/model';

describe('InListConditionImpl should', () => {
  it('store field, operator, and values', () => {
    const expected = {
      field: { fieldName: 'field' },
      operator: 'NOT IN',
      values: [{ value: "'abc'" }, { value: "'def'" }]
    };
    const actual = new InListConditionImpl(new FieldRefImpl('field'), ConditionOperator.NotIn, [
      new LiteralImpl("'abc'"),
      new LiteralImpl("'def'")
    ]);
    expect(actual).toEqual(expected);
  });
  it('return field, operator, and parenthesized comma-separated values separated by spaces for toSoqlSyntax()', () => {
    const expected = "field NOT IN ( 'abc', 'def' )";
    const actual = new InListConditionImpl(new FieldRefImpl('field'), ConditionOperator.NotIn, [
      new LiteralImpl("'abc'"),
      new LiteralImpl("'def'")
    ]).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
