/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/// <reference types="jest" />
/// <reference types="node" />

import { updateChangeLog } from './change-log-generator-utils';

const mockExecFileSync = jest.fn<string, [command: string, args?: readonly string[]]>();

jest.mock('node:child_process', () => ({
  execFileSync: (command: string, args?: readonly string[]) => mockExecFileSync(command, args)
}));
jest.mock('node:fs', () => ({
  __esModule: true,
  default: {
    closeSync: jest.fn(),
    openSync: jest.fn(() => 1),
    readFileSync: jest.fn(() => Buffer.from('')),
    writeSync: jest.fn()
  }
}));

describe('updateChangeLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExecFileSync.mockImplementation((command, args) => {
      if (command === 'git' && args?.[0] === 'log') {
        return 'abc123 fix: secure release notes (#123)';
      }
      if (command === 'git' && args?.[0] === 'show') {
        return 'packages/salesforcedx-vscode-core/src/extension.ts';
      }
      return '';
    });
  });

  test('passes branch names and commit hashes to Git as literal arguments', () => {
    updateChangeLog('origin/release/v66.5.44', 'origin/release/v61.1.202406191959');

    expect(mockExecFileSync).toHaveBeenCalledWith('git', [
      'log',
      '--cherry-pick',
      '--oneline',
      'origin/release/v66.5.44...origin/release/v61.1.202406191959'
    ]);
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['show', '--pretty=', '--name-only', 'abc123']);
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['checkout', 'release/v66.5.44']);
  });
});
