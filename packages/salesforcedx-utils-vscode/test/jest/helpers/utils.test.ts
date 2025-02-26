/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { extractJson, stripAnsiInJson } from '../../../src/helpers/utils';

describe('utils tests', () => {
  describe('extractJson unit tests', () => {
    const initialValue = {
      how: 'does',
      it: true,
      get: 5,
      handled: false
    };
    const jsonString = JSON.stringify(initialValue);

    it('Should be able to parse a json string.', () => {
      const result = extractJson(jsonString);
      expect(result).toStrictEqual(initialValue);
    });
    it('Should be able to parse a json string where valid json is embedded within.', () => {
      const result = extractJson(`now is the time${jsonString}for all good people`);
      expect(result).toStrictEqual(initialValue);
    });

    it('Should throw error if argument is a simple text', () => {
      const invalidJson = initialValue.how;
      expect(() => extractJson(invalidJson)).toThrow('The string "does" does not contain an array or object.');
    });

    it('Should throw error if argument is invalid JSON string', () => {
      const invalidJson = jsonString.substring(10);
      expect(() => extractJson(invalidJson)).toThrow(
        `The string "${invalidJson}" does not contain an array or object.`
      );
    });
    it('Should throw error not enough curly braces', () => {
      const invalidJson = '}';
      expect(() => extractJson(invalidJson)).toThrow(
        `The string "${invalidJson}" does not contain an array or object.`
      );
    });
    it('Should throw error when curly braces not in correct order', () => {
      const invalidJson = '}{';
      expect(() => extractJson(invalidJson)).toThrow(
        `The string "${invalidJson}" does not contain an array or object.`
      );
    });
    it('Should throw error if JSON is invalid', () => {
      const invalidJson = '{invalid}';
      expect(() => extractJson(invalidJson)).toThrow("Expected property name or '}' in JSON at position 1");
    });
  });
  describe('stripAnsiInJson', () => {
    it('should return the original string if hasJson is false', () => {
      const input = 'some string';
      const result = stripAnsiInJson(input, false);
      expect(result).toBe(input);
    });

    it('should return the stripped string if hasJson is true', () => {
      const input = '\u001b[4msome string\u001b[0m';
      const result = stripAnsiInJson(input, true);
      expect(result).toBe('some string');
    });

    it('should return the original string even when it contains ANSI if hasJson is false', () => {
      const input = '\u001b[4msome string\u001b[0m';
      const result = stripAnsiInJson(input, false);
      expect(result).toBe('\u001b[4msome string\u001b[0m');
    });

    it('should return the original string if hasJson is true and the string does not contain ANSI', () => {
      const input = 'some string';
      const result = stripAnsiInJson(input, true);
      expect(result).toBe(input);
    });

    it('should return the original JSON string if hasJson is false', () => {
      const input = '{"key": "value"}';
      const result = stripAnsiInJson(input, false);
      expect(result).toBe(input);
    });

    it('should return the stripped JSON string if hasJson is true', () => {
      const input = '{"key": "\u001b[4mvalue\u001b[0m"}';
      const result = stripAnsiInJson(input, true);
      expect(result).toBe('{"key": "value"}');
    });

    it('should handle complex JSON with ANSI codes', () => {
      const input = '{"key1": "\u001b[31mvalue1\u001b[0m", "key2": "\u001b[32mvalue2\u001b[0m"}';
      const result = stripAnsiInJson(input, true);
      expect(result).toBe('{"key1": "value1", "key2": "value2"}');
    });
  });
});
