/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { meetsMinimumMarketplaceExtensionVersion } from '../../../src/fixtures/createDesktopTest';

describe('meetsMinimumMarketplaceExtensionVersion', () => {
  it.each([
    ['0.11.9', false],
    ['0.12.0', true],
    ['0.12.1', true],
    ['0.13.0', true],
    ['1.0.0', true],
    ['invalid', false]
  ])('requires stable Apex LS 0.12.0 or newer: %s', (version, expected) => {
    expect(meetsMinimumMarketplaceExtensionVersion(version, '0.12.0')).toBe(expected);
  });
});
