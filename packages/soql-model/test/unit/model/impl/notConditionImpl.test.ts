/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldCompareConditionImpl } from '../../../../src/model/impl/fieldCompareConditionImpl';
import { FieldRefImpl } from '../../../../src/model/impl/fieldRefImpl';
import { LiteralImpl } from '../../../../src/model/impl/literalImpl';
import { NotConditionImpl } from '../../../../src/model/impl/notConditionImpl';
import { ConditionOperator } from '../../../../src/model/model';

describe('NotConditionImpl should', () => {
  it('store condition', () => {
    const expected = {
      kind: 'not',
      condition: {
        kind: 'fieldCompare',
        field: { kind: 'fieldRef', fieldName: 'field' },
        operator: '=',
        compareValue: { kind: 'literal', type: 'STRING', value: "'abc'" }
      }
    };
    const actual = new NotConditionImpl(
      new FieldCompareConditionImpl(
        new FieldRefImpl('field'),
        ConditionOperator.Equals,
        new LiteralImpl('STRING', "'abc'")
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
        new LiteralImpl('STRING', "'abc'")
      )
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
