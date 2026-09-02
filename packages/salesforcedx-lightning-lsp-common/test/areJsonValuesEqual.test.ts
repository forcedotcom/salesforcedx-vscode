/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { areJsonValuesEqual } from '../src/baseContext';

describe('areJsonValuesEqual', () => {
  describe('primitive values', () => {
    it('should handle null', () => {
      expect(areJsonValuesEqual(null, null)).toBe(true);
      expect(areJsonValuesEqual(null, undefined)).toBe(false);
    });

    it('should handle undefined', () => {
      expect(areJsonValuesEqual(undefined, undefined)).toBe(true);
      expect(areJsonValuesEqual(undefined, null)).toBe(false);
    });

    it('should handle strings', () => {
      expect(areJsonValuesEqual('hello', 'hello')).toBe(true);
      expect(areJsonValuesEqual('hello', 'world')).toBe(false);
      expect(areJsonValuesEqual('', '')).toBe(true);
    });

    it('should handle numbers', () => {
      expect(areJsonValuesEqual(42, 42)).toBe(true);
      expect(areJsonValuesEqual(42, 43)).toBe(false);
      expect(areJsonValuesEqual(0, 0)).toBe(true);
      expect(areJsonValuesEqual(3.14, 3.14)).toBe(true);
    });

    it('should handle booleans', () => {
      expect(areJsonValuesEqual(true, true)).toBe(true);
      expect(areJsonValuesEqual(false, false)).toBe(true);
      expect(areJsonValuesEqual(true, false)).toBe(false);
    });
  });

  describe('arrays', () => {
    it('should handle empty arrays', () => {
      expect(areJsonValuesEqual([], [])).toBe(true);
    });

    it('should handle arrays with primitives', () => {
      expect(areJsonValuesEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(areJsonValuesEqual(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
      expect(areJsonValuesEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('should handle nested arrays', () => {
      expect(
        areJsonValuesEqual(
          [
            [1, 2],
            [3, 4]
          ],
          [
            [1, 2],
            [3, 4]
          ]
        )
      ).toBe(true);
    });

    it('should handle arrays with mixed types', () => {
      expect(areJsonValuesEqual([1, 'two', true, null], [1, 'two', true, null])).toBe(true);
    });

    it('should preserve array order', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [3, 2, 1];
      expect(areJsonValuesEqual(arr1, arr2)).toBe(false);
    });
  });

  describe('objects', () => {
    it('should handle empty objects', () => {
      expect(areJsonValuesEqual({}, {})).toBe(true);
    });

    it('should handle objects with single property', () => {
      expect(areJsonValuesEqual({ key: 'value' }, { key: 'value' })).toBe(true);
    });

    it('should treat objects with different key orders as equal', () => {
      const obj1 = { z: 1, a: 2, m: 3 };
      const obj2 = { a: 2, m: 3, z: 1 };
      expect(areJsonValuesEqual(obj1, obj2)).toBe(true);
    });

    it('should handle nested objects', () => {
      const obj1 = { outer: { z: 1, a: 2 } };
      const obj2 = { outer: { a: 2, z: 1 } };
      expect(areJsonValuesEqual(obj1, obj2)).toBe(true);
    });

    it('should handle objects with various value types', () => {
      const obj1 = {
        string: 'value',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { key: 'val' }
      };
      const obj2 = {
        nested: { key: 'val' },
        array: [1, 2, 3],
        null: null,
        boolean: true,
        number: 42,
        string: 'value'
      };
      expect(areJsonValuesEqual(obj1, obj2)).toBe(true);
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
      expect(areJsonValuesEqual(obj1, obj2)).toBe(true);
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
      expect(areJsonValuesEqual(arr1, arr2)).toBe(true);
    });

    it('should handle jsconfig-like structures with different array order', () => {
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
      // Object keys are normalized, but array order matters
      expect(areJsonValuesEqual(config1, config2)).toBe(false);
    });

    it('should handle jsconfig-like structures with same array order', () => {
      const config1 = {
        compilerOptions: {
          experimentalDecorators: true,
          target: 'es2017'
        },
        include: ['**/*', '.sfdx/typings/lwc/**/*.d.ts']
      };
      const config2 = {
        include: ['**/*', '.sfdx/typings/lwc/**/*.d.ts'],
        compilerOptions: {
          target: 'es2017',
          experimentalDecorators: true
        }
      };
      // Object keys are normalized, arrays are same
      expect(areJsonValuesEqual(config1, config2)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle objects with special characters in keys', () => {
      const obj1 = { 'key-with-dash': 1, 'key.with.dot': 2 };
      const obj2 = { 'key.with.dot': 2, 'key-with-dash': 1 };
      expect(areJsonValuesEqual(obj1, obj2)).toBe(true);
    });

    it('should handle empty strings as keys', () => {
      const obj1 = { '': 'empty key' };
      const obj2 = { '': 'empty key' };
      expect(areJsonValuesEqual(obj1, obj2)).toBe(true);
    });

    it('should handle numeric string keys', () => {
      const obj1 = { '123': 'numeric', abc: 'alpha' };
      const obj2 = { abc: 'alpha', '123': 'numeric' };
      expect(areJsonValuesEqual(obj1, obj2)).toBe(true);
    });
  });

  describe('consistency', () => {
    it('should produce same result for identical inputs', () => {
      const obj = { z: 1, a: { nested: true }, m: [1, 2, 3] };
      expect(areJsonValuesEqual(obj, obj)).toBe(true);
    });

    it('should return false for semantically different objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };
      expect(areJsonValuesEqual(obj1, obj2)).toBe(false);
    });

    it('should return true regardless of key order', () => {
      const obj1 = { z: 1, y: 2, x: 3, a: 4, b: 5 };
      const obj2 = { a: 4, b: 5, x: 3, y: 2, z: 1 };
      expect(areJsonValuesEqual(obj1, obj2)).toBe(true);
    });
  });

  describe('reference equality fast path', () => {
    it('should return true for same reference', () => {
      const obj = { a: 1, b: 2 };
      expect(areJsonValuesEqual(obj, obj)).toBe(true);
    });

    it('should return true for primitive reference equality', () => {
      const str = 'test';
      expect(areJsonValuesEqual(str, str)).toBe(true);
    });
  });
});
