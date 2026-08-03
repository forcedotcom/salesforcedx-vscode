/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OrgBrowserFilterState } from './protocol';

const parsePattern = (input: string): { pattern: string; isRegex: boolean } => {
  if (input.startsWith('/')) {
    const closeIndex = input.indexOf('/', 1);
    if (closeIndex !== -1) return { pattern: input.substring(1, closeIndex), isRegex: true };
  }
  return { pattern: input, isRegex: false };
};

export const parseFilterText = (
  text: string
): Pick<OrgBrowserFilterState, 'typeFilter' | 'componentFilter' | 'typeIsRegex' | 'componentIsRegex'> => {
  if (!text) return { typeFilter: undefined, componentFilter: undefined, typeIsRegex: false, componentIsRegex: false };
  if (text.startsWith(':')) {
    const componentPattern = parsePattern(text.substring(1));
    return {
      typeFilter: '*',
      componentFilter: componentPattern.pattern,
      typeIsRegex: false,
      componentIsRegex: componentPattern.isRegex
    };
  }
  const colonIndex = text.indexOf(':');
  if (colonIndex === -1) {
    const typePattern = parsePattern(text.trim());
    return {
      typeFilter: typePattern.pattern,
      componentFilter: undefined,
      typeIsRegex: typePattern.isRegex,
      componentIsRegex: false
    };
  }
  const type = parsePattern(text.substring(0, colonIndex).trim());
  const component = parsePattern(text.substring(colonIndex + 1).trim());
  return {
    typeFilter: type.pattern || '*',
    componentFilter: component.pattern,
    typeIsRegex: type.isRegex,
    componentIsRegex: component.isRegex
  };
};

const wildcardToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replaceAll(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replaceAll('*', '.*')}$`, 'i');
};

export const matchesPattern = (text: string, pattern: string, isRegex = false): boolean => {
  if (isRegex) {
    // RegExp construction is the validation boundary for user-provided filter expressions.
    // eslint-disable-next-line functional/no-try-statements
    try {
      return new RegExp(pattern, 'i').test(text);
    } catch {
      return false;
    }
  }
  return pattern.includes('*') ? wildcardToRegex(pattern).test(text) : text.toLowerCase() === pattern.toLowerCase();
};

export const makeFilterState = (showLocal: boolean, showOrg: boolean, text: string): OrgBrowserFilterState => ({
  showLocal,
  showOrg,
  text,
  ...parseFilterText(text)
});
