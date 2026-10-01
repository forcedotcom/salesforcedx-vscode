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
 * Safely creates a RegExp, returning undefined if the pattern is invalid.
 */
const safeRegex = (pattern: string): RegExp | undefined => {
  // eslint-disable-next-line functional/no-try-statements
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return undefined;
  }
};

/**
 * Tests if a string matches a pattern (exact match, wildcard, or regex).
 * Regex mode: pattern is a string extracted from /pattern/ delimiters
 * Wildcard mode: pattern may contain * wildcards
 * Exact mode: pattern has no wildcards
 */
export const matchesPattern = (text: string, pattern: string, isRegex = false): boolean => {
  if (isRegex) {
    const regex = safeRegex(pattern);
    return regex ? regex.test(text) : false;
  }

  if (!pattern.includes('*')) {
    return text.toLowerCase() === pattern.toLowerCase();
  }
  return wildcardToRegex(pattern).test(text);
};

/**
 * Maximum number of metadata types that will trigger automatic component pre-fetching.
 * When a component filter matches more than this many types, the tree provider will
 * use cache-only filtering unless the user explicitly approves a broad fetch.
 */
export const MAX_TYPES_FOR_COMPONENT_PREFETCH = 25;
