/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { bootEnvToDockerArgs, resolveOrgBootEnv } from '../../../src/codeBuilder/auth';
import type { CommandRunner } from '../../../src/codeBuilder/runner';

const REDACTED = "[REDACTED] Use 'sf org auth show-access-token' to view";

/** Fake `sf` runner: org display returns instanceUrl (token redacted); show-access-token returns the real token. */
const makeSfRunner = (opts: {
  instanceUrl?: string;
  token?: string | null;
  displayToken?: string;
}): {
  runner: CommandRunner;
  calls: string[][];
} => {
  const calls: string[][] = [];
  const runner: CommandRunner = (file, args) => {
    calls.push([file, ...args]);
    if (args[0] === 'org' && args[1] === 'display') {
      return JSON.stringify({ result: { instanceUrl: opts.instanceUrl, accessToken: opts.displayToken ?? REDACTED } });
    }
    if (args[0] === 'org' && args[1] === 'auth' && args[2] === 'show-access-token') {
      return JSON.stringify({ result: { accessToken: opts.token } });
    }
    return '{}';
  };
  return { runner, calls };
};

describe('resolveOrgBootEnv', () => {
  it('reads the token from show-access-token, NOT the redacted org display', () => {
    const { runner, calls } = makeSfRunner({ instanceUrl: 'https://x.my.salesforce.com', token: 'REAL_TOKEN' });
    const env = resolveOrgBootEnv('myOrg', { runner });

    expect(env).toEqual({ accessToken: 'REAL_TOKEN', instanceUrl: 'https://x.my.salesforce.com' });
    // It actually called the dedicated token command (the whole point of this helper).
    expect(calls.some(c => c[1] === 'org' && c[2] === 'auth' && c[3] === 'show-access-token')).toBe(true);
    // And it did NOT use org display's (redacted) token.
    expect(env.accessToken).not.toContain('REDACTED');
  });

  it('throws when instanceUrl is missing', () => {
    const { runner } = makeSfRunner({ instanceUrl: undefined, token: 'T' });
    expect(() => resolveOrgBootEnv('myOrg', { runner })).toThrow(/instanceUrl/);
  });

  it('throws when the access token is missing/null', () => {
    const { runner } = makeSfRunner({ instanceUrl: 'https://x', token: null });
    expect(() => resolveOrgBootEnv('myOrg', { runner })).toThrow(/accessToken/);
  });

  it('does not crash when show-access-token result is null (typeof null === object)', () => {
    const runner: CommandRunner = (file, args) => {
      if (args[1] === 'display') return JSON.stringify({ result: { instanceUrl: 'https://x' } });
      return JSON.stringify({ result: null }); // show-access-token
    };
    expect(() => resolveOrgBootEnv('myOrg', { runner })).toThrow(/accessToken/); // clean error, not a TypeError
  });

  it('throws a diagnostic (command + snippet) when sf prints non-JSON stdout noise', () => {
    const runner: CommandRunner = () => 'Warning: @salesforce/cli update available...\n{"result":{}}';
    expect(() => resolveOrgBootEnv('myOrg', { runner })).toThrow(/org display[\s\S]*did not return JSON/);
  });
});

describe('bootEnvToDockerArgs', () => {
  it('maps to the CB image env keys the image reads at boot', () => {
    expect(bootEnvToDockerArgs({ accessToken: 'T', instanceUrl: 'https://x' })).toEqual([
      '-e',
      'SF_ACCESS_TOKEN=T',
      '-e',
      'INSTANCE_URL=https://x'
    ]);
  });

  it('includes extraEnv pairs', () => {
    const args = bootEnvToDockerArgs({ accessToken: 'T', instanceUrl: 'https://x', extraEnv: { FOO: 'bar' } });
    expect(args).toContain('FOO=bar');
  });

  it('does not let extraEnv override the resolved core credentials', () => {
    const args = bootEnvToDockerArgs({
      accessToken: 'REAL',
      instanceUrl: 'https://real',
      extraEnv: { SF_ACCESS_TOKEN: 'HIJACK', INSTANCE_URL: 'https://evil' }
    });
    expect(args).toContain('SF_ACCESS_TOKEN=REAL');
    expect(args).toContain('INSTANCE_URL=https://real');
    expect(args).not.toContain('SF_ACCESS_TOKEN=HIJACK');
    expect(args).not.toContain('INSTANCE_URL=https://evil');
  });
});
