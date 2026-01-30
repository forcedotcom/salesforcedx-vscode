/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AndOrConditionImpl } from '../../../../../src/soql-model/model/impl/andOrConditionImpl';
import { FieldCompareConditionImpl } from '../../../../../src/soql-model/model/impl/fieldCompareConditionImpl';
import { FieldRefImpl } from '../../../../../src/soql-model/model/impl/fieldRefImpl';
import { LiteralImpl } from '../../../../../src/soql-model/model/impl/literalImpl';
import { AndOr, ConditionOperator } from '../../../../../src/soql-model/model/model';

describe('AndOrConditionImpl should', () => {
  it('store left and right conditions and the AndOr operator', () => {
    const expected = {
      leftCondition: { field: { fieldName: 'field' }, operator: '>', compareValue: { value: '1' } },
      andOr: 'OR',
      rightCondition: { field: { fieldName: 'field' }, operator: '<', compareValue: { value: '5' } }
    };
    const actual = new AndOrConditionImpl(
      new FieldCompareConditionImpl(
        new FieldRefImpl('field'),
        ConditionOperator.GreaterThan,
        new LiteralImpl('1')
      ),
      AndOr.Or,
      new FieldCompareConditionImpl(
        new FieldRefImpl('field'),
        ConditionOperator.LessThan,
        new LiteralImpl('5')
      )
    );
    expect(actual).toEqual(expected);
  });
  it('return left condition followed by AndOr operator followed by right condition for toSoqlSyntax()', () => {
    const expected = 'field > 1 OR field < 5';
    const actual = new AndOrConditionImpl(
      new FieldCompareConditionImpl(
        new FieldRefImpl('field'),
        ConditionOperator.GreaterThan,
        new LiteralImpl('1')
      ),
      AndOr.Or,
      new FieldCompareConditionImpl(
        new FieldRefImpl('field'),
        ConditionOperator.LessThan,
        new LiteralImpl('5')
      )
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
