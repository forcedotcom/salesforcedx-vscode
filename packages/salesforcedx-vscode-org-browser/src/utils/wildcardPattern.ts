/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Converts a wildcard pattern to a regular expression.
 * Supports * (match any characters) wildcard syntax.
 * Case-insensitive matching.
 */
const wildcardToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replaceAll(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regexPattern = escaped.replaceAll('*', '.*');
  return new RegExp(`^${regexPattern}$`, 'i');
};

/**
 * Tests if a string matches a pattern (exact match or wildcard).
 */
export const matchesPattern = (text: string, pattern: string): boolean => {
  if (!pattern.includes('*')) {
    return text.toLowerCase() === pattern.toLowerCase();
  }
  return wildcardToRegex(pattern).test(text);
};
