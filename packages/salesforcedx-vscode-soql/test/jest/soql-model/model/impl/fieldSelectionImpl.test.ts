/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';
import * as Soql from '../../../../../src/soql-model/model/model';


describe('FieldSelectionImpl should', () => {
  it('store a field', () => {
    const expected = { field: { fieldName: 'charlie' } };
    const actual = new Impl.FieldSelectionImpl(new Impl.FieldRefImpl(expected.field.fieldName));
    expect(actual).toEqual(expected);
  });
  it('store an unmodeled syntax object as the alias', () => {
    const expected = {
      field: { fieldName: 'brian' },
      alias: { unmodeledSyntax: 'bill', reason: Soql.REASON_UNMODELED_ALIAS },
    };
    const actual = new Impl.FieldSelectionImpl(
      new Impl.FieldRefImpl(expected.field.fieldName),
      new Impl.UnmodeledSyntaxImpl(expected.alias.unmodeledSyntax, Soql.REASON_UNMODELED_ALIAS)
    );
    expect(actual).toEqual(expected);
  });
  it('return field name followed by alias for toSoqlSyntax()', () => {
    const expected = 'rolling stones';
    const actual = new Impl.FieldSelectionImpl(
      new Impl.FieldRefImpl('rolling'),
      new Impl.UnmodeledSyntaxImpl('stones', Soql.REASON_UNMODELED_ALIAS)
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
