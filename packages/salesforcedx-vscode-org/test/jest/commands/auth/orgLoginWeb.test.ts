/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { generateVerificationCode } from '../../../../src/commands/auth/orgLoginWeb';

describe('generateVerificationCode', () => {
  it('should return cc0a for test_token (matches server-side test vector)', () => {
    expect(generateVerificationCode('test_token')).toBe('cc0a');
  });

  it('should return 4 lowercase hex characters', () => {
    const code = generateVerificationCode('any_input');
    expect(code).toMatch(/^[0-9a-f]{4}$/);
  });

  it('should be deterministic', () => {
    const first = generateVerificationCode('same_input');
    const second = generateVerificationCode('same_input');
    expect(first).toBe(second);
  });
});
