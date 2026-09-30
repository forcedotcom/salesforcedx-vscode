/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import * as vscode from 'vscode';
import { isLocalLogging } from '../../../../src/telemetry/utils/devModeUtils';

vi.mock('vscode');
const vscodeMocked = vi.mocked(vscode);

describe('isLocalLogging', () => {
  let mockGet: VitestMock;

  beforeEach(() => {
    mockGet = vi.fn().mockReturnValue('false');
    vscodeMocked.workspace.getConfiguration = vi.fn().mockReturnValue({ get: mockGet });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns true when local logging is enabled', () => {
    mockGet.mockReturnValue('true');
    expect(isLocalLogging('extName')).toBe(true);
  });

  it('returns false when local logging is disabled', () => {
    expect(isLocalLogging('extName')).toBe(false);
  });
});
