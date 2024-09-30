/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { extractJsonObject } from '../../../src';

describe('extractJsonObject unit tests', () => {
  const initialValue = {
    how: 'does',
    it: true,
    get: 5,
    handled: false
  };
  const jsonString = JSON.stringify(initialValue);

  it('Should be able to parse a json string.', () => {
    const result = extractJsonObject(jsonString);
    expect(result).toStrictEqual(initialValue);
  });

  it('Should throw if JSON fails to parse.', () => {
    const invalidJson = jsonString.substring(3);
    expect(() => extractJsonObject(invalidJson)).toThrow(/Unexpected token/);
  });
});
