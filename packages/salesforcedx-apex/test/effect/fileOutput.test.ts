/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Effect from 'effect/Effect';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import { FileOutput } from '../../src/effect/fileOutput';
import { NodeFileOutput } from '../../src/effect/nodeFileOutput';
import { NodeFileOutputLayer } from '../../src/effect/nodeFileOutputLayer';

describe('Node FileOutput', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'apex-file-output-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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
    await expect(readdir(join(directory, 'reports'))).resolves.toEqual(['report.txt']);
  });

  it('writes directly to an existing file', async () => {
    const filePath = join(directory, 'report.txt');
    await writeFile(filePath, 'previous');
    const content = Stream.make('new ', 'résultats 🦊\r\n');

    await Effect.runPromise(
      NodeFileOutput.writeFile(directory, 'report.txt', content).pipe(Effect.provide(NodeFileOutputLayer))
    );

    await expect(readFile(filePath, 'utf8')).resolves.toBe('new résultats 🦊\r\n');
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
  });

  it('removes partial output and returns a typed error when rendering fails', async () => {
    const filePath = join(directory, 'report.txt');
    await writeFile(filePath, 'previous');
    const content = Stream.concat(Stream.make('incomplete'), Stream.die(new Error('render failed')));

    const result = await Effect.runPromise(
      NodeFileOutput.writeFile(directory, 'report.txt', content).pipe(
        Effect.provide(NodeFileOutputLayer),
        Effect.either
      )
    );

    expect(result).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'FileOutputError', path: filePath, message: 'render failed' }
    });
    await expect(readdir(directory)).resolves.toEqual([]);
  });

  it.each([true, false])('interruption removes partial output (previous file existed: %s)', async existing => {
    const filePath = join(directory, 'report.txt');
    if (existing) await writeFile(filePath, 'previous');

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const content = Stream.concat(
          Stream.make('incomplete'),
          Stream.fromEffect(Deferred.succeed(started, undefined).pipe(Effect.zipRight(Effect.never)))
        );
        const fiber = yield* Effect.fork(
          NodeFileOutput.writeFile(directory, 'report.txt', content).pipe(Effect.provide(NodeFileOutputLayer))
        );
        yield* Deferred.await(started);
        return yield* Fiber.interrupt(fiber);
      })
    );

    expect(Exit.isFailure(exit) && Cause.isInterruptedOnly(exit.cause)).toBe(true);
    await expect(readdir(directory)).resolves.toEqual([]);
  });
});
