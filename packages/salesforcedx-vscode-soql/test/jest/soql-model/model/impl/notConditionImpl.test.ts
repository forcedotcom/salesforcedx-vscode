/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldCompareConditionImpl } from '../../../../../src/soql-model/model/impl/fieldCompareConditionImpl';
import { FieldRefImpl } from '../../../../../src/soql-model/model/impl/fieldRefImpl';
import { LiteralImpl } from '../../../../../src/soql-model/model/impl/literalImpl';
import { NotConditionImpl } from '../../../../../src/soql-model/model/impl/notConditionImpl';
import { ConditionOperator } from '../../../../../src/soql-model/model/model';

describe('NotConditionImpl should', () => {
  it('store condition', () => {
    const expected = {
      condition: { field: { fieldName: 'field' }, operator: '=', compareValue: { value: "'abc'" } }
    };
    const actual = new NotConditionImpl(
      new FieldCompareConditionImpl(
        new FieldRefImpl('field'),
        ConditionOperator.Equals,
        new LiteralImpl("'abc'")
      )
    );
    expect(actual).toEqual(expected);
  });
  it('return condition preceded by NOT keyword for toSoqlSyntax()', () => {
    const expected = "NOT field = 'abc'";
    const actual = new NotConditionImpl(
      new FieldCompareConditionImpl(
        new FieldRefImpl('field'),
        ConditionOperator.Equals,
        new LiteralImpl("'abc'")
      )
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
