/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Impl from '../../../../../src/soql-model/model/impl';
import * as Soql from '../../../../../src/soql-model/model/model';


describe('FromImpl should', () => {
  it('store SObject name as a string', () => {
    const expected = { sobjectName: 'ian' };
    const actual = new Impl.FromImpl('ian');
    expect(actual).toEqual(expected);
  });
  it('store as and using clauses as unmodeled syntax', () => {
    const expected = {
      sobjectName: 'black',
      as: { unmodeledSyntax: 'and', reason: Soql.REASON_UNMODELED_AS },
      using: { unmodeledSyntax: 'blue', reason: Soql.REASON_UNMODELED_USING },
    };
    const actual = new Impl.FromImpl(
      expected.sobjectName,
      new Impl.UnmodeledSyntaxImpl(expected.as.unmodeledSyntax, Soql.REASON_UNMODELED_AS),
      new Impl.UnmodeledSyntaxImpl(expected.using.unmodeledSyntax, Soql.REASON_UNMODELED_USING)
    );
    expect(actual).toEqual(expected);
  });
  it('return FROM sobject name followed by as and using clauses for toSoqlSyntax()', () => {
    const expected = 'FROM exile on main';
    const actual = new Impl.FromImpl(
      'exile',
      new Impl.UnmodeledSyntaxImpl('on', Soql.REASON_UNMODELED_AS),
      new Impl.UnmodeledSyntaxImpl('main', Soql.REASON_UNMODELED_USING)
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
