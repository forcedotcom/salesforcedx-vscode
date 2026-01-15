/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';
import { ConditionOperator, LiteralType } from '../../../../../src/soql-model/model/model';


describe('WhereImpl should', () => {
  it('store condition', () => {
    const expected = {
      condition: { field: { fieldName: 'field' }, operator: '=', compareValue: { type: 'STRING', value: "'abc'" } },
    };
    const actual = new Impl.WhereImpl(
      new Impl.FieldCompareConditionImpl(
        new Impl.FieldRefImpl('field'),
        ConditionOperator.Equals,
        new Impl.LiteralImpl(LiteralType.String, "'abc'")
      )
    );
    expect(actual).toEqual(expected);
  });
  it('return condition preceded by WHERE keyword for toSoqlSyntax()', () => {
    const expected = "WHERE field = 'abc'";
    const actual = new Impl.WhereImpl(
      new Impl.FieldCompareConditionImpl(
        new Impl.FieldRefImpl('field'),
        ConditionOperator.Equals,
        new Impl.LiteralImpl(LiteralType.String, "'abc'")
      )
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
