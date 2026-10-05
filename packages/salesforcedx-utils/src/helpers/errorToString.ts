/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Safely converts error-like values to strings for display. */
export const errorToString = (error: unknown): string => {
  if (error instanceof Error) return error.message || error.toString();
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && typeof error.toString === 'function') return error.toString();
  return String(error);
};
