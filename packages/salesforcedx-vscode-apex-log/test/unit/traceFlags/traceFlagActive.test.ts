/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TraceFlagItem } from 'salesforcedx-vscode-services';
import { isTraceFlagActive } from '../../../src/traceFlags/traceFlagActive';

const makeItem = (expirationDate: Date): TraceFlagItem => ({
  id: '7tf000000000000AAA',
  logType: 'USER_DEBUG',
  expirationDate,
  // schema-baked boolean intentionally contradicts the live check below to prove the live read wins
  isActive: false
});

describe('isTraceFlagActive', () => {
  it('returns false for an expired item', () => {
    expect(isTraceFlagActive(makeItem(new Date(Date.now() - 60_000)))).toBe(false);
  });

  it('returns true for a future item', () => {
    expect(isTraceFlagActive(makeItem(new Date(Date.now() + 60_000)))).toBe(true);
  });

  it('returns false at the expiry boundary (expirationDate === now)', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    // expirationDate.getTime() > Date.now() is strict, so equal is not active
    expect(isTraceFlagActive(makeItem(new Date(now)))).toBe(false);
  });
});
