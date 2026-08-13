/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { canonicalizeJson } from '../src/baseContext';

describe('canonicalizeJson', () => {
  describe('primitive values', () => {
    it('should handle null', () => {
      expect(canonicalizeJson(null)).toBe('null');
    });

    it('should handle undefined', () => {
      expect(canonicalizeJson(undefined)).toBe('undefined');
    });

    it('should handle strings', () => {
      expect(canonicalizeJson('hello')).toBe('"hello"');
      expect(canonicalizeJson('')).toBe('""');
      expect(canonicalizeJson('with "quotes"')).toBe('"with \\"quotes\\""');
    });

    it('should handle numbers', () => {
      expect(canonicalizeJson(42)).toBe('42');
      expect(canonicalizeJson(0)).toBe('0');
      expect(canonicalizeJson(-1)).toBe('-1');
      expect(canonicalizeJson(3.14)).toBe('3.14');
    });

    it('should handle booleans', () => {
      expect(canonicalizeJson(true)).toBe('true');
      expect(canonicalizeJson(false)).toBe('false');
    });
  });

  describe('arrays', () => {
    it('should handle empty arrays', () => {
      expect(canonicalizeJson([])).toBe('[]');
    });

    it('should handle arrays with primitives', () => {
      expect(canonicalizeJson([1, 2, 3])).toBe('[1,2,3]');
      expect(canonicalizeJson(['a', 'b', 'c'])).toBe('["a","b","c"]');
    });

    it('should handle nested arrays', () => {
      expect(
        canonicalizeJson([
          [1, 2],
          [3, 4]
        ])
      ).toBe('[[1,2],[3,4]]');
    });

    it('should handle arrays with mixed types', () => {
      expect(canonicalizeJson([1, 'two', true, null])).toBe('[1,"two",true,null]');
    });

    it('should preserve array order', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [3, 2, 1];
      expect(canonicalizeJson(arr1)).not.toBe(canonicalizeJson(arr2));
    });
  });

  describe('objects', () => {
    it('should handle empty objects', () => {
      expect(canonicalizeJson({})).toBe('{}');
    });

    it('should handle objects with single property', () => {
      expect(canonicalizeJson({ key: 'value' })).toBe('{"key":"value"}');
    });

    it('should sort object keys alphabetically', () => {
      const obj1 = { z: 1, a: 2, m: 3 };
      const obj2 = { a: 2, m: 3, z: 1 };
      const expected = '{"a":2,"m":3,"z":1}';
      expect(canonicalizeJson(obj1)).toBe(expected);
      expect(canonicalizeJson(obj2)).toBe(expected);
    });

    it('should handle nested objects', () => {
      const obj1 = { outer: { z: 1, a: 2 } };
      const obj2 = { outer: { a: 2, z: 1 } };
      const expected = '{"outer":{"a":2,"z":1}}';
      expect(canonicalizeJson(obj1)).toBe(expected);
      expect(canonicalizeJson(obj2)).toBe(expected);
    });

    it('should handle objects with various value types', () => {
      const obj = {
        string: 'value',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { key: 'val' }
      };
      const result = canonicalizeJson(obj);
      expect(result).toContain('"string":"value"');
      expect(result).toContain('"number":42');
      expect(result).toContain('"boolean":true');
      expect(result).toContain('"null":null');
      expect(result).toContain('"array":[1,2,3]');
      expect(result).toContain('"nested":{"key":"val"}');
    });
  });

  describe('complex structures', () => {
    it('should handle deeply nested structures', () => {
      const obj1 = {
        level1: {
          level2: {
            level3: {
              array: [1, 2, 3],
              value: 'deep'
            }
          }
        }
      };
      const obj2 = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
              array: [1, 2, 3]
            }
          }
        }
      };
      expect(canonicalizeJson(obj1)).toBe(canonicalizeJson(obj2));
    });

    it('should handle arrays of objects', () => {
      const arr1 = [
        { z: 1, a: 2 },
        { b: 3, y: 4 }
      ];
      const arr2 = [
        { a: 2, z: 1 },
        { y: 4, b: 3 }
      ];
      expect(canonicalizeJson(arr1)).toBe(canonicalizeJson(arr2));
    });

    it('should produce consistent output for jsconfig-like structures', () => {
      const config1 = {
        compilerOptions: {
          experimentalDecorators: true,
          target: 'es2017'
        },
        include: ['**/*', '.sfdx/typings/lwc/**/*.d.ts']
      };
      const config2 = {
        include: ['.sfdx/typings/lwc/**/*.d.ts', '**/*'],
        compilerOptions: {
          target: 'es2017',
          experimentalDecorators: true
        }
      };
      // Keys should be sorted, but array order preserved
      const result1 = canonicalizeJson(config1);
      const result2 = canonicalizeJson(config2);

      // Both should have keys in same order
      expect(result1).toContain('"compilerOptions"');
      expect(result1).toContain('"include"');
      expect(result2).toContain('"compilerOptions"');
      expect(result2).toContain('"include"');

      // But array order differs, so results differ
      expect(result1).not.toBe(result2);
    });
  });

  describe('edge cases', () => {
    it('should handle objects with special characters in keys', () => {
      const obj = { 'key-with-dash': 1, 'key.with.dot': 2 };
      const result = canonicalizeJson(obj);
      expect(result).toContain('"key-with-dash"');
      expect(result).toContain('"key.with.dot"');
    });

    it('should handle empty strings as keys', () => {
      const obj = { '': 'empty key' };
      expect(canonicalizeJson(obj)).toBe('{"":"empty key"}');
    });

    it('should handle numeric string keys', () => {
      const obj = { '123': 'numeric', abc: 'alpha' };
      const result = canonicalizeJson(obj);
      expect(result).toContain('"123"');
      expect(result).toContain('"abc"');
    });
  });

  describe('consistency', () => {
    it('should produce identical output for identical inputs', () => {
      const obj = { z: 1, a: { nested: true }, m: [1, 2, 3] };
      const result1 = canonicalizeJson(obj);
      const result2 = canonicalizeJson(obj);
      expect(result1).toBe(result2);
    });

    it('should produce different output for semantically different objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };
      expect(canonicalizeJson(obj1)).not.toBe(canonicalizeJson(obj2));
    });

    it('should produce same output regardless of key order', () => {
      const obj1 = { z: 1, y: 2, x: 3, a: 4, b: 5 };
      const obj2 = { a: 4, b: 5, x: 3, y: 2, z: 1 };
      expect(canonicalizeJson(obj1)).toBe(canonicalizeJson(obj2));
    });
  });
});
