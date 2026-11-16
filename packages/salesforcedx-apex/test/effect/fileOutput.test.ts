/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { promises as fs } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as Effect from 'effect/Effect';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import * as Stream from 'effect/Stream';
import { FileOutput } from '../../src/effect/fileOutput';
import { NodeFileOutput, NodeFileOutputLayer } from '../../src/effect/nodeFileOutput';

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

  it('replaces an existing file only after the stream completes', async () => {
    const filePath = join(directory, 'report.txt');
    await writeFile(filePath, 'previous');
    const content = Stream.make('new ', 'résultats 🦊\r\n');

    await Effect.runPromise(NodeFileOutput.writeFile(directory, 'report.txt', content));

    await expect(readFile(filePath, 'utf8')).resolves.toBe('new résultats 🦊\r\n');
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
  });

  it('returns a typed error without leaving a truncated file when rendering fails', async () => {
    const filePath = join(directory, 'report.txt');
    await writeFile(filePath, 'previous');
    const content = Stream.concat(Stream.make('incomplete'), Stream.die(new Error('render failed')));

    const result = await Effect.runPromise(
      NodeFileOutput.writeFile(directory, 'report.txt', content).pipe(Effect.either)
    );

    expect(result).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'FileOutputError', path: filePath, message: 'render failed' }
    });
    await expect(readFile(filePath, 'utf8')).resolves.toBe('previous');
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
  });

  it('returns a typed commit error and removes staged output when rename fails', async () => {
    const filePath = join(directory, 'report.txt');
    await mkdir(filePath);

    const result = await Effect.runPromise(
      NodeFileOutput.writeFile(directory, 'report.txt', Stream.make('complete')).pipe(Effect.either)
    );

    expect(result).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'FileOutputError', operation: 'rename', path: filePath }
    });
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
    await expect(readdir(filePath)).resolves.toEqual([]);
  });

  it('retries short byte writes without corrupting UTF-8 content', async () => {
    const text = 'résultats 🦊';
    const open = fs.open;
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const file = await open(...args);
      const write = file.write.bind(file);
      vi.spyOn(file, 'write').mockImplementationOnce(async () => {
        const { bytesWritten } = await write(Buffer.from(text), 0, 2);
        return { bytesWritten, buffer: '' };
      });
      return file;
    });

    await Effect.runPromise(NodeFileOutput.writeFile(directory, 'report.txt', Stream.make(text)));

    await expect(readFile(join(directory, 'report.txt'), 'utf8')).resolves.toBe(text);
  });

  it('waits for an in-flight write before interruption closes and removes staged output', async () => {
    const started = Promise.withResolvers<void>();
    const finishWrite = Promise.withResolvers<void>();
    const open = fs.open;
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const file = await open(...args);
      const write = file.write.bind(file);
      vi.spyOn(file, 'write').mockImplementationOnce(async () => {
        started.resolve();
        await finishWrite.promise;
        const { bytesWritten } = await write(Buffer.from('new'));
        return { bytesWritten, buffer: '' };
      });
      return file;
    });
    const filePath = join(directory, 'report.txt');
    await writeFile(filePath, 'previous');
    const fiber = Effect.runFork(NodeFileOutput.writeFile(directory, 'report.txt', Stream.make('new')));
    try {
      await started.promise;
      await Effect.runPromise(Fiber.interruptFork(fiber));
      expect(await Effect.runPromise(Fiber.poll(fiber))).toEqual(Option.none());
    } finally {
      finishWrite.resolve();
    }
    const exit = await Effect.runPromise(Fiber.await(fiber));

    expect(Exit.isFailure(exit) && Cause.isInterruptedOnly(exit.cause)).toBe(true);
    await expect(readFile(filePath, 'utf8')).resolves.toBe('previous');
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
  });

  it('waits for a started commit before reporting interruption', async () => {
    const started = Promise.withResolvers<void>();
    const finishRename = Promise.withResolvers<void>();
    const rename = fs.rename;
    vi.spyOn(fs, 'rename').mockImplementationOnce(async (...args) => {
      started.resolve();
      await finishRename.promise;
      await rename(...args);
    });
    const filePath = join(directory, 'report.txt');
    await writeFile(filePath, 'previous');
    const fiber = Effect.runFork(NodeFileOutput.writeFile(directory, 'report.txt', Stream.make('new')));
    try {
      await started.promise;
      await Effect.runPromise(Fiber.interruptFork(fiber));
      expect(await Effect.runPromise(Fiber.poll(fiber))).toEqual(Option.none());
      await expect(readFile(filePath, 'utf8')).resolves.toBe('previous');
    } finally {
      finishRename.resolve();
    }
    const exit = await Effect.runPromise(Fiber.await(fiber));

    expect(Exit.isFailure(exit) && Cause.isInterruptedOnly(exit.cause)).toBe(true);
    await expect(readFile(filePath, 'utf8')).resolves.toBe('new');
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
  });

  it.each([true, false])('interruption preserves existing output (%s) and cleans staged output', async existing => {
    const filePath = join(directory, 'report.txt');
    if (existing) await writeFile(filePath, 'previous');

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const content = Stream.concat(
          Stream.make('incomplete'),
          Stream.fromEffect(Deferred.succeed(started, undefined).pipe(Effect.zipRight(Effect.never)))
        );
        const fiber = yield* Effect.fork(NodeFileOutput.writeFile(directory, 'report.txt', content));
        yield* Deferred.await(started);
        return yield* Fiber.interrupt(fiber);
      })
    );

    expect(Exit.isFailure(exit) && Cause.isInterruptedOnly(exit.cause)).toBe(true);
    await expect(readdir(directory)).resolves.toEqual(existing ? ['report.txt'] : []);
    if (existing) await expect(readFile(filePath, 'utf8')).resolves.toBe('previous');
  });
});
