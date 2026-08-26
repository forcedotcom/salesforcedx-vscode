/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CONTAINER_PORT, pull, restart, run, teardown, type ReadinessProbe } from '../../../src/codeBuilder/lifecycle';
import type { CommandRunner } from '../../../src/codeBuilder/runner';
import type { BootEnv } from '../../../src/codeBuilder/auth';

const BOOT_ENV: BootEnv = { accessToken: 'TOK', instanceUrl: 'https://x.my.salesforce.com' };

const recorder = (): { runner: CommandRunner; calls: string[][] } => {
  const calls: string[][] = [];
  return { calls, runner: (file, args) => (calls.push([file, ...args]), '') };
};

const alwaysReady: ReadinessProbe = () => Promise.resolve(true);
const neverReady: ReadinessProbe = () => Promise.resolve(false);

describe('lifecycle', () => {
  it('pull issues docker pull', () => {
    const { runner, calls } = recorder();
    pull('img:latest', { runner });
    expect(calls[0]).toEqual(['docker', 'pull', 'img:latest']);
  });

  it('run builds the correct docker run argv (env, mount, port) and returns a healthy handle', async () => {
    const { runner, calls } = recorder();
    const handle = await run(
      {
        name: 'cb',
        imageRef: 'img:latest',
        publishedPort: 8123,
        bootEnv: BOOT_ENV,
        mounts: [{ hostPath: '/host/fixture', containerPath: '/home/codebuilder/fixture-project' }],
        readiness: { probe: alwaysReady, intervalMs: 1 }
      },
      { runner }
    );

    const runCall = calls.find(c => c[1] === 'run')!;
    expect(runCall).toContain('-d');
    expect(runCall).toEqual(expect.arrayContaining(['--name', 'cb']));
    expect(runCall).toEqual(expect.arrayContaining(['-e', 'SF_ACCESS_TOKEN=TOK']));
    expect(runCall).toEqual(expect.arrayContaining(['-e', 'INSTANCE_URL=https://x.my.salesforce.com']));
    expect(runCall).toEqual(expect.arrayContaining(['-v', '/host/fixture:/home/codebuilder/fixture-project']));
    expect(runCall).toEqual(expect.arrayContaining(['-p', `8123:${CONTAINER_PORT}`]));
    expect(runCall.at(-1)).toBe('img:latest');

    expect(handle).toEqual({
      name: 'cb',
      imageRef: 'img:latest',
      publishedUrl: 'http://localhost:8123',
      publishedPort: 8123,
      bootEnv: BOOT_ENV
    });
  });

  it('run throws (with docker logs) when the workbench never becomes ready', async () => {
    const runner: CommandRunner = (file, args) => (args[0] === 'logs' ? 'boot failed line' : '');
    await expect(
      run(
        {
          name: 'cb',
          imageRef: 'img',
          publishedPort: 8123,
          bootEnv: BOOT_ENV,
          readiness: { probe: neverReady, timeoutMs: 5, intervalMs: 1 }
        },
        { runner }
      )
    ).rejects.toThrow(/never became reachable[\s\S]*boot failed line/);
  });

  it('restart issues docker restart then waits for readiness', async () => {
    const { runner, calls } = recorder();
    const handle = {
      name: 'cb',
      imageRef: 'img',
      publishedUrl: 'http://localhost:8123',
      publishedPort: 8123,
      bootEnv: BOOT_ENV
    };
    const returned = await restart(handle, { probe: alwaysReady, intervalMs: 1 }, { runner });
    expect(calls.find(c => c[1] === 'restart')).toEqual(['docker', 'restart', 'cb']);
    expect(returned).toBe(handle);
  });

  it('teardown removes the container and swallows errors', () => {
    const { runner, calls } = recorder();
    const handle = {
      name: 'cb',
      imageRef: 'img',
      publishedUrl: 'http://localhost:8123',
      publishedPort: 8123,
      bootEnv: BOOT_ENV
    };
    teardown(handle, { runner });
    expect(calls[0]).toEqual(['docker', 'rm', '-f', 'cb']);
    // A throwing runner must not propagate out of teardown (safe in finally/always cleanup).
    expect(() =>
      teardown(handle, {
        runner: () => {
          throw new Error('boom');
        }
      })
    ).not.toThrow();
  });
});
