/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { errorToString } from '../../../src/helpers/errorUtils';

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
  });
});
