/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { extractJsonObject } from '../../../src/helpers/utils';

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

  it('Should throw error if argument is a simple text', () => {
    const invalidJson = initialValue.how;
    expect(() => extractJsonObject(invalidJson)).toThrow(
      'The string "does" is not a valid JSON string.'
    );
  });

  it('Should throw error if argument is invalid JSON string', () => {
    const invalidJson = jsonString.substring(10);
    expect(() => extractJsonObject(invalidJson)).toThrow(
      `The string "${invalidJson}" is not a valid JSON string.`
    );
  });
});
