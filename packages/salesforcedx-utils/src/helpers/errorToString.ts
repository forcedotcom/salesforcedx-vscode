/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getErrorMessage } from './getErrorMessage';

/** Converts errors for display, using toString when an Error has an empty message. */
export const errorToString = (error: unknown): string => {
  if (error instanceof Error) return getErrorMessage(error) || error.toString();
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && typeof error.toString === 'function') return error.toString();
  return getErrorMessage(error);
};
