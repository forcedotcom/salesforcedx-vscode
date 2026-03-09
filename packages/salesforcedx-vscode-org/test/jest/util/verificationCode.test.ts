/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { generateVerificationCode, getVerificationCodeDescription, showVerificationCodeIfNeeded } from '../../../src/util/verificationCode';

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

describe('getVerificationCodeDescription', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should append verification code suffix when CODE_BUILDER_STATE is set', () => {
    process.env.CODE_BUILDER_STATE = 'test_token';

    const result = getVerificationCodeDescription('SFDX: Authorize an Org');

    expect(result).toBe('SFDX: Authorize an Org (Verification Code: cc0a)');
  });

  it('should return base description unchanged when CODE_BUILDER_STATE is not set', () => {
    delete process.env.CODE_BUILDER_STATE;

    const result = getVerificationCodeDescription('SFDX: Authorize an Org');

    expect(result).toBe('SFDX: Authorize an Org');
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

  it('should show modal information message when CODE_BUILDER_STATE is set', async () => {
    process.env.CODE_BUILDER_STATE = 'test_token';

    await showVerificationCodeIfNeeded();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Verification Code: cc0a — If prompted, enter this code in your browser window.',
      { modal: true },
      'OK'
    );
  });

  it('should not show message when CODE_BUILDER_STATE is not set', async () => {
    delete process.env.CODE_BUILDER_STATE;

    await showVerificationCodeIfNeeded();

    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });
});
