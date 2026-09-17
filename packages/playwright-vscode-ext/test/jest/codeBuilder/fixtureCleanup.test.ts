/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CONTAINER_USER, removePathsInContainer } from '../../../src/codeBuilder/fixtureCleanup';
import type { CommandRunner } from '../../../src/codeBuilder/runner';

const recorder = (): { runner: CommandRunner; calls: string[][] } => {
  const calls: string[][] = [];
  return { calls, runner: (file, args) => (calls.push([file, ...args]), '') };
};

describe('removePathsInContainer', () => {
  it('runs `docker exec -u codebuilder <name> rm -rf -- <paths>` as argv tokens (no shell)', () => {
    const { runner, calls } = recorder();
    removePathsInContainer('cb', ['/a/one', '/a/two'], { runner });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(['docker', 'exec', '-u', CONTAINER_USER, 'cb', 'rm', '-rf', '--', '/a/one', '/a/two']);
  });

  it('is a no-op when there are no paths (never shells out)', () => {
    const { runner, calls } = recorder();
    removePathsInContainer('cb', [], { runner });
    expect(calls).toHaveLength(0);
  });

  it('honors a custom user', () => {
    const { runner, calls } = recorder();
    removePathsInContainer('cb', ['/a/one'], { runner, user: 'root' });
    expect(calls[0]).toEqual(expect.arrayContaining(['-u', 'root']));
  });

  it('propagates a real docker failure so a failed cleanup is loud', () => {
    const runner: CommandRunner = () => {
      throw new Error('Error: No such container: cb');
    };
    expect(() => removePathsInContainer('cb', ['/a/one'], { runner })).toThrow(/No such container/);
  });
});
