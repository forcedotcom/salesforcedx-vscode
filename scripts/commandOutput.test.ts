/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeServices from '@effect/platform-node/NodeServices';
import * as Effect from 'effect/Effect';
import * as Result from 'effect/Result';
import { commandOutput } from './commandOutput.mts';

const run = (source: string) =>
  commandOutput({ executable: process.execPath, args: ['-e', source] }).pipe(
    Effect.provide(NodeServices.layer),
    Effect.result,
    Effect.runPromise
  );

describe('commandOutput', () => {
  it('captures stdout and stderr from a successful command', async () => {
    const result = await run("process.stdout.write('out'); process.stderr.write('err')");

    expect(Result.isSuccess(result) && result.success).toEqual({ stdout: 'out', stderr: 'err' });
  });

  it('fails on nonzero exit and includes stderr', async () => {
    const result = await run("process.stderr.write('failed'); process.exitCode = 7");

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure._tag).toBe('CommandFailed');
      expect(result.failure.exitCode).toBe(7);
      expect(result.failure.message).toContain('failed');
    }
  });
});
