/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';

describe('SelectExprsImpl should', () => {
  it('store select expressions', () => {
    const expected = {
      selectExpressions: [{ field: { fieldName: 'sticky' } }, { field: { fieldName: 'fingers' } }],
    };
    const actual = new Impl.SelectExprsImpl([
      new Impl.FieldSelectionImpl(new Impl.FieldRefImpl(expected.selectExpressions[0].field.fieldName)),
      new Impl.FieldSelectionImpl(new Impl.FieldRefImpl(expected.selectExpressions[1].field.fieldName)),
    ]);
    expect(actual).toEqual(expected);
  });
  it('return SELECT when there are no select expressions for toSoqlSyntax()', () => {
    const expected = 'SELECT ';
    const actual = new Impl.SelectExprsImpl([]).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
  it('return comma separated list of fields for toSoqlSyntax()', () => {
    const expected = 'SELECT let, it, bleed';
    const actual = new Impl.SelectExprsImpl([
      new Impl.FieldSelectionImpl(new Impl.FieldRefImpl('let')),
      new Impl.FieldSelectionImpl(new Impl.FieldRefImpl('it')),
      new Impl.FieldSelectionImpl(new Impl.FieldRefImpl('bleed')),
    ]).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
