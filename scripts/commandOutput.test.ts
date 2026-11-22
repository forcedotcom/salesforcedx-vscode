/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeContext from '@effect/platform-node/NodeContext';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import { commandOutput } from './commandOutput.mts';

const run = (source: string) =>
  commandOutput({ executable: process.execPath, args: ['-e', source] }).pipe(
    Effect.provide(NodeContext.layer),
    Effect.either,
    Effect.runPromise
  );

describe('commandOutput', () => {
  it('captures stdout and stderr from a successful command', async () => {
    const result = await run("process.stdout.write('out'); process.stderr.write('err')");

    expect(Either.isRight(result) && result.right).toEqual({ stdout: 'out', stderr: 'err' });
  });

  it('fails on nonzero exit and includes stderr', async () => {
    const result = await run("process.stderr.write('failed'); process.exitCode = 7");

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left._tag).toBe('CommandFailed');
      expect(result.left.exitCode).toBe(7);
      expect(result.left.message).toContain('failed');
    }
  });
});
