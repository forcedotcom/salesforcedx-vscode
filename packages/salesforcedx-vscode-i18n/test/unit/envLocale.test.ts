/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { parseNlsLocale } from '../../src/envLocale';

describe('parseNlsLocale', () => {
  it('returns ja for a supported locale', () => {
    expect(parseNlsLocale(JSON.stringify({ locale: 'ja' }))).toBe('ja');
  });

  it('lowercases before matching', () => {
    expect(parseNlsLocale(JSON.stringify({ locale: 'JA' }))).toBe('ja');
  });

  it('returns undefined for an unsupported locale', () => {
    expect(parseNlsLocale(JSON.stringify({ locale: 'de' }))).toBeUndefined();
  });

  it('returns undefined when the locale field is missing', () => {
    expect(parseNlsLocale(JSON.stringify({ foo: 'bar' }))).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(parseNlsLocale(undefined)).toBeUndefined();
  });

  it('returns undefined for malformed JSON (no throw)', () => {
    expect(parseNlsLocale('{not json')).toBeUndefined();
  });

  it('returns undefined when locale is not a string', () => {
    expect(parseNlsLocale(JSON.stringify({ locale: 123 }))).toBeUndefined();
  });
});
