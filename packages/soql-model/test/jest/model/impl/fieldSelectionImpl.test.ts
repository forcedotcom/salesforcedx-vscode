/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FieldRefImpl } from '../../../../src/model/impl/fieldRefImpl';
import { FieldSelectionImpl } from '../../../../src/model/impl/fieldSelectionImpl';
import { UnmodeledSyntaxImpl } from '../../../../src/model/impl/unmodeledSyntaxImpl';
import { REASON_UNMODELED_ALIAS } from '../../../../src/model/model';

describe('FieldSelectionImpl should', () => {
  it('store a field', () => {
    const expected = { kind: 'fieldSelection', field: { kind: 'fieldRef', fieldName: 'charlie' } };
    const actual = new FieldSelectionImpl(new FieldRefImpl(expected.field.fieldName));
    expect(actual).toEqual(expected);
  });
  it('store an unmodeled syntax object as the alias', () => {
    const expected = {
      kind: 'fieldSelection',
      field: { kind: 'fieldRef', fieldName: 'brian' },
      alias: { kind: 'unmodeled', unmodeledSyntax: 'bill', reason: REASON_UNMODELED_ALIAS }
    };
    const actual = new FieldSelectionImpl(
      new FieldRefImpl(expected.field.fieldName),
      new UnmodeledSyntaxImpl(expected.alias.unmodeledSyntax, REASON_UNMODELED_ALIAS)
    );
    expect(actual).toEqual(expected);
  });
  it('return field name followed by alias for toSoqlSyntax()', () => {
    const expected = 'rolling stones';
    const actual = new FieldSelectionImpl(
      new FieldRefImpl('rolling'),
      new UnmodeledSyntaxImpl('stones', REASON_UNMODELED_ALIAS)
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
