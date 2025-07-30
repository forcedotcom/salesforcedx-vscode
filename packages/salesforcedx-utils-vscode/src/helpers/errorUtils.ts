/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Safely converts any error-like value to a string for use in templates
 * Handles Error objects, strings, and unknown types
 */
export const errorToString = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'toString' in error) {
    return error.toString();
  }
  return String(error);
};

/**
 * Type guard to check if a value is an Error instance
 */
export const isError = (value: unknown): value is Error => value instanceof Error;

/**
 * Type guard to check if a value is a string
 */
export const isErrorString = (value: unknown): value is string => typeof value === 'string';

/**
 * Safely extracts error message, preferring Error.message over toString()
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message || error.toString();
  }
  return errorToString(error);
};

/**
 * Safely extracts error stack trace if available
 */
export const getErrorStack = (error: unknown): string | undefined => {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return undefined;
};
