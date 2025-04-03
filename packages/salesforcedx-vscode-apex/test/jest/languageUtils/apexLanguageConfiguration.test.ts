/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { wordPattern } from '../../../src/languageUtils/apexLanguageConfiguration';

describe('Apex Language Configuration', () => {
  describe('wordPattern', () => {
    it('should match valid Apex identifiers', () => {
      const validIdentifiers = [
        'myVariable',
        'MyClass',
        'my_variable',
        'myVariable123',
        'MyClass123',
        'test22Integer',
        '22Integer',
        '_22Integer'
      ];

      validIdentifiers.forEach(identifier => {
        expect(identifier.match(wordPattern)).toBeTruthy();
        expect(identifier.match(wordPattern)![0]).toBe(identifier);
      });
    });

    it('should match decimal numbers', () => {
      const validNumbers = ['1.0', '123.456', '-1.0', '-123.456', '0.123', '-0.123', '123.456e789', '-123.456e789'];

      validNumbers.forEach(number => {
        expect(number.match(wordPattern)).toBeTruthy();
        expect(number.match(wordPattern)![0]).toBe(number);
      });
    });

    it('should match parts of strings containing special characters', () => {
      const testCases = [
        { input: 'my`variable', expected: ['my', 'variable'] },
        { input: 'my~variable', expected: ['my', 'variable'] },
        { input: 'my!variable', expected: ['my', 'variable'] },
        { input: 'my@variable', expected: ['my', 'variable'] },
        { input: 'my#variable', expected: ['my', 'variable'] },
        { input: 'my%variable', expected: ['my', 'variable'] },
        { input: 'my^variable', expected: ['my', 'variable'] },
        { input: 'my&variable', expected: ['my', 'variable'] },
        { input: 'my*variable', expected: ['my', 'variable'] },
        { input: 'my(variable', expected: ['my', 'variable'] },
        { input: 'my)variable', expected: ['my', 'variable'] },
        { input: 'my-variable', expected: ['my', 'variable'] },
        { input: 'my=variable', expected: ['my', 'variable'] },
        { input: 'my+variable', expected: ['my', 'variable'] },
        { input: 'my[variable', expected: ['my', 'variable'] },
        { input: 'my{variable', expected: ['my', 'variable'] },
        { input: 'my]variable', expected: ['my', 'variable'] },
        { input: 'my}variable', expected: ['my', 'variable'] },
        { input: 'my\\variable', expected: ['my', 'variable'] },
        { input: 'my|variable', expected: ['my', 'variable'] },
        { input: 'my;variable', expected: ['my', 'variable'] },
        { input: 'my:variable', expected: ['my', 'variable'] },
        { input: "my'variable", expected: ['my', 'variable'] },
        { input: 'my"variable', expected: ['my', 'variable'] },
        { input: 'my,variable', expected: ['my', 'variable'] },
        { input: 'my.variable', expected: ['my', 'variable'] },
        { input: 'my<variable', expected: ['my', 'variable'] },
        { input: 'my>variable', expected: ['my', 'variable'] },
        { input: 'my/variable', expected: ['my', 'variable'] },
        { input: 'my?variable', expected: ['my', 'variable'] },
        { input: 'my variable', expected: ['my', 'variable'] }
      ];

      testCases.forEach(({ input, expected }) => {
        const matches = input.match(wordPattern);
        expect(matches).toBeTruthy();
        expect(matches).toEqual(expected);
      });
    });
  });
});
