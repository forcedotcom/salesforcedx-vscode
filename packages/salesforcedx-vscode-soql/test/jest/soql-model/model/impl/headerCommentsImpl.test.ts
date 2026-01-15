/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';

describe('HeaderCommentsImpl should', () => {
  it('store comments text', () => {
    const expected = { text: '// Comment line 1\n//Comment line 2\n' };
    const actual = new Impl.HeaderCommentsImpl('// Comment line 1\n//Comment line 2\n');
    expect(actual).toEqual(expected);
  });

  it('return the comment string on toSoqlSyntax()', () => {
    const expected = '// Comment line 1\n//Comment line 2\n';
    const actual = new Impl.HeaderCommentsImpl('// Comment line 1\n//Comment line 2\n').toSoqlSyntax();
    expect(actual).toEqual(expected);
  });

  it('return the empty string on toSoqlSyntax() when no comments', () => {
    let actual = new Impl.HeaderCommentsImpl(null as unknown as string).toSoqlSyntax();
    expect(actual).toEqual('');

    actual = new Impl.HeaderCommentsImpl(undefined as unknown as string).toSoqlSyntax();
    expect(actual).toEqual('');

    actual = new Impl.HeaderCommentsImpl('').toSoqlSyntax();
    expect(actual).toEqual('');
  });
});
