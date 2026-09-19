/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/// <reference types="vitest/globals" />
/// <reference types="node" />

import { updateChangeLog } from './change-log-generator-utils';

const mockExecFileSync = vi.fn<(command: string, args?: readonly string[]) => string>();

vi.mock('node:child_process', () => ({
  execFileSync: (command: string, args?: readonly string[]) => mockExecFileSync(command, args)
}));
vi.mock('node:fs', () => ({
  __esModule: true,
  default: {
    closeSync: vi.fn(),
    openSync: vi.fn(() => 1),
    readFileSync: vi.fn(() => Buffer.from('')),
    writeSync: vi.fn()
  }
}));

describe('updateChangeLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
