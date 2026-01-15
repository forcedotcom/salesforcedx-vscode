/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';
import { AndOr, ConditionOperator, LiteralType } from '../../../../../src/soql-model/model/model';


describe('AndOrConditionImpl should', () => {
  it('store left and right conditions and the AndOr operator', () => {
    const expected = {
      leftCondition: { field: { fieldName: 'field' }, operator: '>', compareValue: { type: 'NUMBER', value: '1' } },
      andOr: 'OR',
      rightCondition: { field: { fieldName: 'field' }, operator: '<', compareValue: { type: 'NUMBER', value: '5' } },
    };
    const actual = new Impl.AndOrConditionImpl(
      new Impl.FieldCompareConditionImpl(
        new Impl.FieldRefImpl('field'),
        ConditionOperator.GreaterThan,
        new Impl.LiteralImpl(LiteralType.Number, '1')
      ),
      AndOr.Or,
      new Impl.FieldCompareConditionImpl(
        new Impl.FieldRefImpl('field'),
        ConditionOperator.LessThan,
        new Impl.LiteralImpl(LiteralType.Number, '5')
      )
    );
    expect(actual).toEqual(expected);
  });
  it('return left condition followed by AndOr operator followed by right condition for toSoqlSyntax()', () => {
    const expected = 'field > 1 OR field < 5';
    const actual = new Impl.AndOrConditionImpl(
      new Impl.FieldCompareConditionImpl(
        new Impl.FieldRefImpl('field'),
        ConditionOperator.GreaterThan,
        new Impl.LiteralImpl(LiteralType.Number, '1')
      ),
      AndOr.Or,
      new Impl.FieldCompareConditionImpl(
        new Impl.FieldRefImpl('field'),
        ConditionOperator.LessThan,
        new Impl.LiteralImpl(LiteralType.Number, '5')
      )
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
