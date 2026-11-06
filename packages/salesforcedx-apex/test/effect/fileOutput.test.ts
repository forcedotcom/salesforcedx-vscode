/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { FileOutput } from '../../src/effect/fileOutput';
import { NodeFileOutputLayer } from '../../src/effect/nodeFileOutput';

describe('Node FileOutput', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'apex-file-output-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('writes streamed text to the requested file', async () => {
    const paths = await Effect.runPromise(
      Effect.gen(function* () {
        const fileOutput = yield* FileOutput;
        const reportDirectory = join(directory, 'reports');
        yield* fileOutput.createDirectory(reportDirectory);
        return yield* fileOutput.writeFile(reportDirectory, 'report.txt', Stream.make('first\n', 'second\n'));
      }).pipe(Effect.provide(NodeFileOutputLayer))
    );

    expect(paths).toBe(join(directory, 'reports', 'report.txt'));
    await expect(readFile(paths, 'utf8')).resolves.toBe('first\nsecond\n');
  });
});
