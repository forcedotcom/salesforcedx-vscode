/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FromImpl } from '../../../../../src/soql-model/model/impl/fromImpl';
import { UnmodeledSyntaxImpl } from '../../../../../src/soql-model/model/impl/unmodeledSyntaxImpl';
import { REASON_UNMODELED_AS, REASON_UNMODELED_USING } from '../../../../../src/soql-model/model/model';


describe('FromImpl should', () => {
  it('store SObject name as a string', () => {
    const expected = { sobjectName: 'ian' };
    const actual = new FromImpl('ian');
    expect(actual).toEqual(expected);
  });
  it('store as and using clauses as unmodeled syntax', () => {
    const expected = {
      sobjectName: 'black',
      as: { unmodeledSyntax: 'and', reason: REASON_UNMODELED_AS },
      using: { unmodeledSyntax: 'blue', reason: REASON_UNMODELED_USING },
    };
    const actual = new FromImpl(
      expected.sobjectName,
      new UnmodeledSyntaxImpl(expected.as.unmodeledSyntax, REASON_UNMODELED_AS),
      new UnmodeledSyntaxImpl(expected.using.unmodeledSyntax, REASON_UNMODELED_USING)
    );
    expect(actual).toEqual(expected);
  });
  it('return FROM sobject name followed by as and using clauses for toSoqlSyntax()', () => {
    const expected = 'FROM exile on main';
    const actual = new FromImpl(
      'exile',
      new UnmodeledSyntaxImpl('on', REASON_UNMODELED_AS),
      new UnmodeledSyntaxImpl('main', REASON_UNMODELED_USING)
    ).toSoqlSyntax();
    expect(actual).toEqual(expected);
  });
});
