/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { UnmodeledSyntaxImpl } from '../../../../../src/soql-model/model/impl/unmodeledSyntaxImpl';
import { SyntaxOptions } from '../../../../../src/soql-model/model/model';


describe('SoqlModelObjectImpl should', () => {
  const testModelObject = new UnmodeledSyntaxImpl('mick', { reasonCode: 'unmodeled:fake', message: 'fake SOQL' });
  it('use SyntaxOptions that are passed in', () => {
    const expectedSyntaxOptions = new SyntaxOptions();
    expectedSyntaxOptions.indent = 50;
    const actualSyntaxOptions = testModelObject.getSyntaxOptions(expectedSyntaxOptions);
    expect(actualSyntaxOptions).toBe(expectedSyntaxOptions);
  });
  it('create default SyntaxOptions if none are passed in', () => {
    const expectedSyntaxOptions = new SyntaxOptions();
    const actualSyntaxOptions = testModelObject.getSyntaxOptions();
    expect(actualSyntaxOptions).toEqual(expectedSyntaxOptions);
  });
});
