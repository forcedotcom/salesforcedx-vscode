/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Command from '@effect/platform/Command';
import * as HashMap from 'effect/HashMap';
import * as Effect from 'effect/Effect';
import { CrossSpawnCommandExecutorLive, resolveCommandEnv } from '../../../src/terminal/crossSpawnCommandExecutor';

describe('resolveCommandEnv', () => {
  it('merges the overlay over process.env so PATH survives', () => {
    process.env.CHILD_PROCESS_TEST_PARENT = 'parent-value';
    const env = resolveCommandEnv(HashMap.fromIterable([['SF_JSON_TO_STDOUT', 'true']]));
    expect(env.CHILD_PROCESS_TEST_PARENT).toBe('parent-value');
    expect(env.SF_JSON_TO_STDOUT).toBe('true');
    const pathEntry = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH');
    expect(pathEntry?.[1]).toBe(process.env.PATH);
    delete process.env.CHILD_PROCESS_TEST_PARENT;
  });

  it('still includes process.env when the overlay is empty', () => {
    const env = resolveCommandEnv(HashMap.empty());
    const pathEntry = Object.entries(env).find(([key]) => key.toUpperCase() === 'PATH');
    expect(pathEntry?.[1]).toBe(process.env.PATH);
  });
});

describe('CrossSpawnCommandExecutorLive', () => {
  it('rejects piped commands', async () => {
    const error = await Effect.runPromise(
      Command.start(Command.pipeTo(Command.make('echo'), Command.make('cat'))).pipe(
        Effect.scoped,
        Effect.provide(CrossSpawnCommandExecutorLive),
        Effect.flip
      )
    );
    expect(error._tag).toBe('BadArgument');
  });

  it('rejects shell commands', async () => {
    const error = await Effect.runPromise(
      Command.start(Command.runInShell(Command.make('echo'), true)).pipe(
        Effect.scoped,
        Effect.provide(CrossSpawnCommandExecutorLive),
        Effect.flip
      )
    );
    expect(error._tag).toBe('BadArgument');
  });
});
