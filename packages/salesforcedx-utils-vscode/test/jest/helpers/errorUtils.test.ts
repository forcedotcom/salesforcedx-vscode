/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { errorToString, isError, isErrorString, getErrorMessage, getErrorStack } from '../../../src/helpers/errorUtils';

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

  describe('isError', () => {
    it('should return true for Error instances', () => {
      expect(isError(new Error())).toBe(true);
      expect(isError(new TypeError())).toBe(true);
      expect(isError(new ReferenceError())).toBe(true);
    });

    it('should return false for non-Error values', () => {
      expect(isError('string')).toBe(false);
      expect(isError(42)).toBe(false);
      expect(isError({})).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
    });
  });

  describe('isErrorString', () => {
    it('should return true for strings', () => {
      expect(isErrorString('error message')).toBe(true);
      expect(isErrorString('')).toBe(true);
    });

    it('should return false for non-string values', () => {
      expect(isErrorString(new Error())).toBe(false);
      expect(isErrorString(42)).toBe(false);
      expect(isErrorString({})).toBe(false);
      expect(isErrorString(null)).toBe(false);
      expect(isErrorString(undefined)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return Error.message for Error objects', () => {
      const error = new Error('Test error message');
      expect(getErrorMessage(error)).toBe('Test error message');
    });

    it('should fallback to toString for Error objects without message', () => {
      const error = new Error();
      expect(getErrorMessage(error)).toBe('Error');
    });

    it('should handle non-Error values', () => {
      expect(getErrorMessage('string error')).toBe('string error');
      expect(getErrorMessage(42)).toBe('42');
      expect(getErrorMessage({ toString: () => 'custom' })).toBe('custom');
    });
  });

  describe('getErrorStack', () => {
    it('should return stack trace for Error objects with stack', () => {
      const error = new Error('Test error');
      const stack = getErrorStack(error);
      expect(stack).toBeDefined();
      expect(typeof stack).toBe('string');
      expect(stack).toContain('Error: Test error');
    });

    it('should return undefined for Error objects without stack', () => {
      const error = new Error('Test error');
      error.stack = undefined;
      expect(getErrorStack(error)).toBeUndefined();
    });

    it('should return undefined for non-Error values', () => {
      expect(getErrorStack('string')).toBeUndefined();
      expect(getErrorStack(42)).toBeUndefined();
      expect(getErrorStack({})).toBeUndefined();
      expect(getErrorStack(null)).toBeUndefined();
      expect(getErrorStack(undefined)).toBeUndefined();
    });
  });
});
