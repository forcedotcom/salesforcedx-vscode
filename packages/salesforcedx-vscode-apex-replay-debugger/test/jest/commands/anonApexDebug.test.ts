/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getYYYYMMddHHmmssDateFormat } from '@salesforce/salesforcedx-utils-vscode';

describe('getYYYYMMddHHmmssDateFormat', () => {
  it('formats a date with all double-digit components', () => {
    // 2024-12-25 14:30:59
    const date = new Date(2024, 11, 25, 14, 30, 59);
    expect(getYYYYMMddHHmmssDateFormat(date)).toBe('20241225143059');
  });

  it('zero-pads single-digit month, day, hour, minute, second', () => {
    // 2024-01-02 03:04:05
    const date = new Date(2024, 0, 2, 3, 4, 5);
    expect(getYYYYMMddHHmmssDateFormat(date)).toBe('20240102030405');
  });

  it('handles midnight on Jan 1', () => {
    const date = new Date(2025, 0, 1, 0, 0, 0);
    expect(getYYYYMMddHHmmssDateFormat(date)).toBe('20250101000000');
  });

  it('handles end of day on Dec 31', () => {
    const date = new Date(2025, 11, 31, 23, 59, 59);
    expect(getYYYYMMddHHmmssDateFormat(date)).toBe('20251231235959');
  });
});
