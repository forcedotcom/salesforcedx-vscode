/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CONTAINER_USER,
  deleteSourceInContainer,
  removePathsInContainer
} from '../../../src/codeBuilder/fixtureCleanup';
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

describe('deleteSourceInContainer', () => {
  it('runs `sf project delete source` in the project dir as the container user, metadata as positional args', () => {
    const { runner, calls } = recorder();
    deleteSourceInContainer('cb', '/home/codebuilder/fixture-project', ['ApexClass:Foo', 'ApexClass:Bar'], { runner });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([
      'docker',
      'exec',
      '-u',
      CONTAINER_USER,
      '-w',
      '/home/codebuilder/fixture-project',
      'cb',
      'bash',
      '-lc',
      'sf project delete source --no-prompt --track-source "$@"',
      'sf-delete-source',
      '--metadata',
      'ApexClass:Foo',
      '--metadata',
      'ApexClass:Bar'
    ]);
  });

  it('is a no-op when there is no metadata (never shells out)', () => {
    const { runner, calls } = recorder();
    deleteSourceInContainer('cb', '/p', [], { runner });
    expect(calls).toHaveLength(0);
  });

  it('propagates a failed delete so the caller can fall back', () => {
    const runner: CommandRunner = () => {
      throw new Error('No ApexClass named: Foo found');
    };
    expect(() => deleteSourceInContainer('cb', '/p', ['ApexClass:Foo'], { runner })).toThrow(/No ApexClass named/);
  });
});
