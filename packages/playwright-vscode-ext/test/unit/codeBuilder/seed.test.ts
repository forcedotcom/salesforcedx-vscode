/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ContainerHandle } from '../../../src/codeBuilder/lifecycle';
import type { CommandRunner } from '../../../src/codeBuilder/runner';
import { FIXTURE_MOUNT_PATH, seedWorkspace } from '../../../src/codeBuilder/seed';

const HANDLE: ContainerHandle = {
  name: 'cb',
  imageRef: 'img',
  publishedUrl: 'http://localhost:8123',
  publishedPort: 8123,
  mounts: []
};

const recorder = (): { runner: CommandRunner; calls: string[][] } => {
  const calls: string[][] = [];
  return { calls, runner: (file, args) => (calls.push([file, ...args]), '') };
};

describe('seedWorkspace', () => {
  it('passes the fixture path as a container env var (not interpolated) and writes both files', () => {
    const { runner, calls } = recorder();
    seedWorkspace(HANDLE, { runner });

    const call = calls[0];
    expect(call.slice(0, 2)).toEqual(['docker', 'exec']);
    // Fixture path is a `-e FIXTURE_PATH=…` argv token — data, not shell-interpolated.
    expect(call).toEqual(expect.arrayContaining(['-e', `FIXTURE_PATH=${FIXTURE_MOUNT_PATH}`]));
    expect(call).toContain('cb');
    const script = call.at(-1) as string;
    // Writes coder.json from $FIXTURE_PATH, and disables workspace trust.
    expect(script).toContain('coder.json');
    expect(script).toContain('jq -n --arg folder "$FIXTURE_PATH"');
    expect(script).toContain('security.workspace.trust.enabled');
    expect(script).toContain('chown codebuilder:codebuilder');
  });

  it('honors a custom fixture path (still as an env token, safe for odd paths)', () => {
    const { runner, calls } = recorder();
    seedWorkspace(HANDLE, { runner, fixturePath: '/home/codebuilder/my project' });
    expect(calls[0]).toEqual(expect.arrayContaining(['-e', 'FIXTURE_PATH=/home/codebuilder/my project']));
  });

  it('preflights jq inside the container so a missing jq fails loud, not opaque', () => {
    const { runner, calls } = recorder();
    seedWorkspace(HANDLE, { runner });
    const script = calls[0].at(-1) as string;
    expect(script).toContain('command -v jq');
  });

  it('validates the fixture path against the recorded mounts and throws on a mismatch', () => {
    const { runner } = recorder();
    const handle: ContainerHandle = {
      ...HANDLE,
      mounts: [{ hostPath: '/host/fixture', containerPath: '/home/codebuilder/fixture-project' }]
    };
    // Caller mounted at the default but asks to seed a path that isn't mounted — must fail clearly.
    expect(() => seedWorkspace(handle, { runner, fixturePath: '/home/codebuilder/typo' })).toThrow(
      /not a container mount/
    );
  });

  it('accepts a fixture path that matches a recorded mount', () => {
    const { runner, calls } = recorder();
    const handle: ContainerHandle = {
      ...HANDLE,
      mounts: [{ hostPath: '/host/fixture', containerPath: '/home/codebuilder/fixture-project' }]
    };
    seedWorkspace(handle, { runner, fixturePath: '/home/codebuilder/fixture-project' });
    expect(calls[0]).toEqual(expect.arrayContaining(['-e', 'FIXTURE_PATH=/home/codebuilder/fixture-project']));
  });

  it('appends docker logs to the error when the exec fails (diagnostic parity with lifecycle)', () => {
    const runner: CommandRunner = (_file, args) => {
      if (args[0] === 'logs') return 'container boot log line';
      throw new Error('exec exited 127');
    };
    expect(() => seedWorkspace(HANDLE, { runner })).toThrow(/seedWorkspace failed[\s\S]*container boot log line/);
  });
});
