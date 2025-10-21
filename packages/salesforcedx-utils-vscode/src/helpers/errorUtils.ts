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
    return error.message ?? error.toString();
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'toString' in error) {
    return error.toString();
  }
  return String(error);
};
