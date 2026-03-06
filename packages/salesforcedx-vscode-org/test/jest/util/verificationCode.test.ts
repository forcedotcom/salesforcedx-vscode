/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { generateVerificationCode, showVerificationCodeIfNeeded } from '../../../src/util/verificationCode';

jest.mock('vscode', () => ({
  window: {
    showInformationMessage: jest.fn()
  }
}));

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

describe('showVerificationCodeIfNeeded', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should show verification code when CODE_BUILDER_STATE is set', () => {
    process.env.CODE_BUILDER_STATE = 'test_token';

    showVerificationCodeIfNeeded();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('cc0a')
    );
  });

  it('should not show message when CODE_BUILDER_STATE is not set', () => {
    delete process.env.CODE_BUILDER_STATE;

    showVerificationCodeIfNeeded();

    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

});
