/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { errorToString } from '../../../src/helpers/errorToString';

describe('errorUtils', () => {
  describe('errorToString', () => {
    it('should handle Error objects', () => {
      const error = new Error('Test error message');
      expect(errorToString(error)).toBe('Test error message');
    });

    it('should handle Error objects without message', () => {
      const error = new Error();
      expect(errorToString(error)).toBe('Error');
    });

    it('should handle string errors', () => {
      const error = 'String error message';
      expect(errorToString(error)).toBe('String error message');
    });

    it('should handle objects with toString method', () => {
      const error = {
        toString: () => 'Custom error object'
      };
      expect(errorToString(error)).toBe('Custom error object');
    });

    it('should handle null and undefined', () => {
      expect(errorToString(null)).toBe('null');
      expect(errorToString(undefined)).toBe('undefined');
    });

    it('should handle numbers and other primitives', () => {
      expect(errorToString(42)).toBe('42');
      expect(errorToString(true)).toBe('true');
      expect(errorToString(false)).toBe('false');
    });

    it('does not unwrap object messages or nested errors', () => {
      expect(errorToString({ message: 'object message' })).toBe('[object Object]');
      expect(errorToString({ error: new Error('nested') })).toBe('[object Object]');
    });

    it('preserves object toString precedence over Symbol.toPrimitive', () => {
      expect(errorToString({ toString: () => 'custom', [Symbol.toPrimitive]: () => 'primitive' })).toBe('custom');
    });

    it('uses custom toString for an Error with an empty message', () => {
      const error = new Error();
      error.toString = () => 'custom';
      expect(errorToString(error)).toBe('custom');
    });
  });
});
