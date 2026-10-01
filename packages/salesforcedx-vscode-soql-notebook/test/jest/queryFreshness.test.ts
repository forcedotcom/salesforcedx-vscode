/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  isStaleQueryOutput,
  normalizeSoqlText,
  outputQueryText,
  payloadIsMarkedStale,
  withoutStaleFlag,
  withStaleFlag
} from '../../src/queryFreshness';

describe('query freshness', () => {
  it('treats whitespace-only SOQL differences as the same query', () => {
    expect(normalizeSoqlText('SELECT  Id\nFROM Account')).toBe('SELECT Id FROM Account');
  });

  it('marks results stale when the cell query no longer matches the stored query', () => {
    expect(isStaleQueryOutput('SELECT Name FROM Account', 'SELECT Id FROM Account')).toBe(true);
    expect(isStaleQueryOutput('SELECT Id FROM Account', 'SELECT Id FROM Account')).toBe(false);
    expect(isStaleQueryOutput('SELECT Id FROM Account', undefined)).toBe(false);
  });

  it('reads queryText from a stored output payload', () => {
    expect(outputQueryText({ queryText: 'SELECT Id FROM Account' })).toBe('SELECT Id FROM Account');
    expect(outputQueryText({})).toBeUndefined();
  });

  it('adds and removes the stale flag without changing other fields', () => {
    const payload = { queryText: 'SELECT Id FROM Account', totalSize: 1 };
    expect(withStaleFlag(payload, true)).toEqual({ ...payload, stale: true });
    expect(withStaleFlag({ ...payload, stale: true }, false)).toEqual(payload);
    expect(payloadIsMarkedStale({ stale: true })).toBe(true);
    expect(withoutStaleFlag({ ...payload, stale: true })).toEqual(payload);
  });
});
