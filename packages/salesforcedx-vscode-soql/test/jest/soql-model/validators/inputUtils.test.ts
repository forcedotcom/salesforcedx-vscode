/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { splitMultiInputValues } from '../../../../src/soql-model/validators/inputUtils';

describe('splitMultiInputValues should', () => {
  it('split input at comma', () => {
    const expected = ["'string'", 'TRUE', '15', 'USD100', "interstitial'quote and spaces", "'escaped\\'quote'", 'end'];
    const actual = splitMultiInputValues(
      "  'string' , TRUE, 15, USD100 , interstitial'quote and spaces ,'escaped\\'quote',end"
    );
    expect(actual).toEqual(expected);
  });
});
