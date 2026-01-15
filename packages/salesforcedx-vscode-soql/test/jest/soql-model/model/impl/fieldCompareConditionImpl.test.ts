/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';
import { ConditionOperator, LiteralType } from '../../../../../src/soql-model/model/model';


describe('FieldCompareConditionImpl should', () => {
  it('store field, operator, and value', () => {
    const expected = { field: { fieldName: 'field' }, operator: '=', compareValue: { type: 'STRING', value: "'abc'" } };
    const actual = new Impl.FieldCompareConditionImpl(
      new Impl.FieldRefImpl('field'),
      ConditionOperator.Equals,
      new Impl.LiteralImpl(LiteralType.String, "'abc'")
    );
    expect(actual).toEqual(expected);
  });
  it('return field, operator, and value separated by spaces for toSoqlSyntax()', () => {
    const expected = "field = 'abc'";
    const actual = new Impl.FieldCompareConditionImpl(
      new Impl.FieldRefImpl('field'),
      ConditionOperator.Equals,
      new Impl.LiteralImpl(LiteralType.String, "'abc'")
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
