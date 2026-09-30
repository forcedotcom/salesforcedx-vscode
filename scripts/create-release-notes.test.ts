/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/// <reference types="vitest/globals" />
/// <reference types="node" />

import { updateChangeLog } from './change-log-generator-utils';
import { createReleaseNotes } from './create-release-notes';

const mockExecFileSync = vi.fn<(command: string, args?: readonly string[]) => string>();

vi.mock('node:child_process', () => ({
  execFileSync: (command: string, args?: readonly string[]) => mockExecFileSync(command, args)
}));
vi.mock('./change-log-generator-utils');

describe('createReleaseNotes', () => {
  const originalGithubActions = process.env.GITHUB_ACTIONS;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_ACTIONS = 'true';
    mockExecFileSync.mockImplementation((command, args) =>
      command === 'git' && args?.[0] === 'tag' ? 'v61.1.202406191959\n' : ''
    );
  });

  afterAll(() => {
    process.env.GITHUB_ACTIONS = originalGithubActions;
  });

  test('passes release branches to Git as literal arguments', () => {
    createReleaseNotes('66.5.44');

    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['checkout', 'release/v66.5.44']);
    expect(vi.mocked(updateChangeLog)).toHaveBeenCalledWith(
      'origin/release/v66.5.44',
      'origin/release/v61.1.202406191959'
    );
    expect(mockExecFileSync).toHaveBeenCalledWith('git', ['push', '-u', 'origin', 'release/v66.5.44']);
  });
});
