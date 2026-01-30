/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldCompareConditionImpl } from '../../../../../src/soql-model/model/impl/fieldCompareConditionImpl';
import { FieldRefImpl } from '../../../../../src/soql-model/model/impl/fieldRefImpl';
import { LiteralImpl } from '../../../../../src/soql-model/model/impl/literalImpl';
import { ConditionOperator } from '../../../../../src/soql-model/model/model';

describe('FieldCompareConditionImpl should', () => {
  it('store field, operator, and value', () => {
    const expected = { field: { fieldName: 'field' }, operator: '=', compareValue: { value: "'abc'" } };
    const actual = new FieldCompareConditionImpl(
      new FieldRefImpl('field'),
      ConditionOperator.Equals,
      new LiteralImpl("'abc'")
    );
    expect(actual).toEqual(expected);
  });
  it('return field, operator, and value separated by spaces for toSoqlSyntax()', () => {
    const expected = "field = 'abc'";
    const actual = new FieldCompareConditionImpl(
      new FieldRefImpl('field'),
      ConditionOperator.Equals,
      new LiteralImpl("'abc'")
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
