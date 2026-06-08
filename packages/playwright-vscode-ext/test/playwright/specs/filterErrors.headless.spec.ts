/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test, expect } from '@playwright/test';
import { filterErrors, filterNetworkErrors } from '../../../src/utils/helpers';

test.describe('filterErrors', () => {
  test('filters out ConsoleError whose text matches a known pattern', () => {
    const errors = [{ text: 'GET http://localhost/favicon.ico 404 (Not Found)', url: '' }];
    const result = filterErrors(errors);
    expect(result).toHaveLength(0);
  });

  test('passes through ConsoleError whose text does NOT match any pattern', () => {
    const errors = [{ text: 'Uncaught TypeError: Cannot read property of undefined', url: '' }];
    const result = filterErrors(errors);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Uncaught TypeError: Cannot read property of undefined');
  });

  test('filters by url field when text does not match', () => {
    const errors = [{ text: 'some error', url: 'https://marketplace.visualstudio.com/foo' }];
    const result = filterErrors(errors);
    expect(result).toHaveLength(0);
  });

  test('is case-insensitive', () => {
    const errors = [{ text: 'FAVICON.ICO not found' }];
    const result = filterErrors(errors);
    expect(result).toHaveLength(0);
  });
});

test.describe('filterNetworkErrors', () => {
  test('filters out NetworkError whose url matches a known pattern', () => {
    const errors = [
      { status: 404, url: 'https://marketplace.visualstudio.com/items', description: 'HTTP 404 Not Found' }
    ];
    const result = filterNetworkErrors(errors);
    expect(result).toHaveLength(0);
  });

  test('passes through NetworkError whose url does NOT match any pattern', () => {
    const errors = [
      { status: 500, url: 'https://api.example.com/data', description: 'HTTP 500 Internal Server Error' }
    ];
    const result = filterNetworkErrors(errors);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://api.example.com/data');
  });

  test('filters by description field', () => {
    const errors = [{ status: 400, url: 'https://example.com/api', description: 'Package2Member query failed' }];
    const result = filterNetworkErrors(errors);
    expect(result).toHaveLength(0);
  });

  test('is case-insensitive', () => {
    const errors = [{ status: 404, url: 'https://MARKETPLACE.VISUALSTUDIO.COM/foo', description: 'HTTP 404' }];
    const result = filterNetworkErrors(errors);
    expect(result).toHaveLength(0);
  });
});
