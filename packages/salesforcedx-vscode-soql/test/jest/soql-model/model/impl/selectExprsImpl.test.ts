/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldRefImpl } from '../../../../../src/soql-model/model/impl/fieldRefImpl';
import { FieldSelectionImpl } from '../../../../../src/soql-model/model/impl/fieldSelectionImpl';
import { SelectExprsImpl } from '../../../../../src/soql-model/model/impl/selectExprsImpl';

describe('SelectExprsImpl should', () => {
  it('store select expressions', () => {
    const expected = {
      selectExpressions: [{ field: { fieldName: 'sticky' } }, { field: { fieldName: 'fingers' } }],
    };
    const actual = new SelectExprsImpl([
      new FieldSelectionImpl(new FieldRefImpl(expected.selectExpressions[0].field.fieldName)),
      new FieldSelectionImpl(new FieldRefImpl(expected.selectExpressions[1].field.fieldName)),
    ]);
    expect(actual).toEqual(expected);
  });
  it('return SELECT when there are no select expressions for toSoqlSyntax()', () => {
    const expected = 'SELECT ';
    const actual = new SelectExprsImpl([]).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
  it('return comma separated list of fields for toSoqlSyntax()', () => {
    const expected = 'SELECT let, it, bleed';
    const actual = new SelectExprsImpl([
      new FieldSelectionImpl(new FieldRefImpl('let')),
      new FieldSelectionImpl(new FieldRefImpl('it')),
      new FieldSelectionImpl(new FieldRefImpl('bleed')),
    ]).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
