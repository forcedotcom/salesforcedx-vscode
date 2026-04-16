/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { isLocalLogging } from '../../../../src/telemetry/utils/devModeUtils';

jest.mock('vscode');
const vscodeMocked = jest.mocked(vscode);

describe('isLocalLogging', () => {
  let mockGet: jest.Mock;

  beforeEach(() => {
    mockGet = jest.fn().mockReturnValue('false');
    vscodeMocked.workspace.getConfiguration = jest.fn().mockReturnValue({ get: mockGet });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns true when local logging is enabled', () => {
    mockGet.mockReturnValue('true');
    expect(isLocalLogging('extName')).toBe(true);
  });

  it('returns false when local logging is disabled', () => {
    expect(isLocalLogging('extName')).toBe(false);
  });
});
