/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldCompareConditionImpl } from '../../../../src/model/impl/fieldCompareConditionImpl';
import { FieldRefImpl } from '../../../../src/model/impl/fieldRefImpl';
import { LiteralImpl } from '../../../../src/model/impl/literalImpl';
import { ConditionOperator } from '../../../../src/model/model';

describe('FieldCompareConditionImpl should', () => {
  it('store field, operator, and value', () => {
    const expected = {
      kind: 'fieldCompare',
      field: { kind: 'fieldRef', fieldName: 'field' },
      operator: '=',
      compareValue: { kind: 'literal', type: 'STRING', value: "'abc'" }
    };
    const actual = new FieldCompareConditionImpl(
      new FieldRefImpl('field'),
      ConditionOperator.Equals,
      new LiteralImpl('STRING', "'abc'")
    );
    expect(actual).toEqual(expected);
  });
  it('return field, operator, and value separated by spaces for toSoqlSyntax()', () => {
    const expected = "field = 'abc'";
    const actual = new FieldCompareConditionImpl(
      new FieldRefImpl('field'),
      ConditionOperator.Equals,
      new LiteralImpl('STRING', "'abc'")
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
