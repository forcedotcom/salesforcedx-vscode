/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';

describe('UnmodeledSyntaxImpl should', () => {
  it('store a string as unmodeledSyntax', () => {
    const expected = { unmodeledSyntax: 'ronnie', reason: { reasonCode: 'unmodeled:fake', message: 'fake SOQL' } };
    const actual = new Impl.UnmodeledSyntaxImpl(expected.unmodeledSyntax, expected.reason);
    expect(actual).toEqual(expected);
  });
  it('return stored syntax for toSoqlSyntax()', () => {
    const expected = 'keith';
    const actual = new Impl.UnmodeledSyntaxImpl(expected, {
      reasonCode: 'unmodeled:fake',
      message: 'fake SOQL',
    }).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
