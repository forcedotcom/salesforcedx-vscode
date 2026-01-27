/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';
import { ConditionOperator } from '../../../../../src/soql-model/model/model';

describe('NestedConditionImpl should', () => {
  it('store condition', () => {
    const expected = {
      condition: { field: { fieldName: 'field' }, operator: '=', compareValue: { value: "'abc'" } }
    };
    const actual = new Impl.NestedConditionImpl(
      new Impl.FieldCompareConditionImpl(
        new Impl.FieldRefImpl('field'),
        ConditionOperator.Equals,
        new Impl.LiteralImpl("'abc'")
      )
    );
    expect(actual).toEqual(expected);
  });
  it('return nested condition in parentheses for toSoqlSyntax()', () => {
    const expected = "( field = 'abc' )";
    const actual = new Impl.NestedConditionImpl(
      new Impl.FieldCompareConditionImpl(
        new Impl.FieldRefImpl('field'),
        ConditionOperator.Equals,
        new Impl.LiteralImpl("'abc'")
      )
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
