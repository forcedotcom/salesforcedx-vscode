/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';
import { ConditionOperator, LiteralType } from '../../../../../src/soql-model/model/model';


describe('InListConditionImpl should', () => {
  it('store field, operator, and values', () => {
    const expected = {
      field: { fieldName: 'field' },
      operator: 'NOT IN',
      values: [
        { type: 'STRING', value: "'abc'" },
        { type: 'STRING', value: "'def'" },
      ],
    };
    const actual = new Impl.InListConditionImpl(new Impl.FieldRefImpl('field'), ConditionOperator.NotIn, [
      new Impl.LiteralImpl(LiteralType.String, "'abc'"),
      new Impl.LiteralImpl(LiteralType.String, "'def'"),
    ]);
    expect(actual).toEqual(expected);
  });
  it('return field, operator, and parenthesized comma-separated values separated by spaces for toSoqlSyntax()', () => {
    const expected = "field NOT IN ( 'abc', 'def' )";
    const actual = new Impl.InListConditionImpl(new Impl.FieldRefImpl('field'), ConditionOperator.NotIn, [
      new Impl.LiteralImpl(LiteralType.String, "'abc'"),
      new Impl.LiteralImpl(LiteralType.String, "'def'"),
    ]).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
