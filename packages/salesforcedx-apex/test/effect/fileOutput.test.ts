/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import * as Effect from 'effect/Effect';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import * as Stream from 'effect/Stream';
import { FileOutput } from '../../src/effect/fileOutput';
import { makeFileOutput, NodeFileOutput } from '../../src/effect/nodeFileOutput';
import { NodeFileOutputLayer, NodeFileOutputPlatformLayer } from '../../src/effect/nodeFileOutputLayer';

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

  it('replaces an existing file with complete streamed output', async () => {
    const filePath = join(directory, 'report.txt');
    await writeFile(filePath, 'previous');
    const content = Stream.make('new ', 'résultats 🦊\r\n');

    await Effect.runPromise(
      NodeFileOutput.writeFile(directory, 'report.txt', content).pipe(Effect.provide(NodeFileOutputLayer))
    );

    await expect(readFile(filePath, 'utf8')).resolves.toBe('new résultats 🦊\r\n');
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
  });

  it('preserves the previous output and returns a typed error when rendering fails', async () => {
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
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
    await expect(readFile(filePath, 'utf8')).resolves.toBe('previous');
  });

  it('keeps the previous result visible until the replacement stream completes', async () => {
    const filePath = join(directory, 'report.txt');
    await writeFile(filePath, 'previous');
    const started = await Effect.runPromise(Deferred.make<void>());
    const finish = await Effect.runPromise(Deferred.make<void>());
    const content = Stream.concat(
      Stream.make('new '),
      Stream.fromEffect(
        Deferred.succeed(started, undefined).pipe(Effect.zipRight(Deferred.await(finish)), Effect.as('result'))
      )
    );
    const fiber = Effect.runFork(
      NodeFileOutput.writeFile(directory, 'report.txt', content).pipe(Effect.provide(NodeFileOutputLayer))
    );
    try {
      await Effect.runPromise(Deferred.await(started));
      await expect(readFile(filePath, 'utf8')).resolves.toBe('previous');
    } finally {
      await Effect.runPromise(Deferred.succeed(finish, undefined));
      await Effect.runPromise(Fiber.join(fiber));
    }
    await expect(readFile(filePath, 'utf8')).resolves.toBe('new result');
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
  });

  it('cleans staged output when committing the replacement fails', async () => {
    const filePath = join(directory, 'report.txt');
    await mkdir(filePath);
    const result = await Effect.runPromise(
      NodeFileOutput.writeFile(directory, 'report.txt', Stream.make('complete')).pipe(
        Effect.provide(NodeFileOutputLayer),
        Effect.either
      )
    );

    expect(result).toMatchObject({ _tag: 'Left', left: { _tag: 'FileOutputError', path: filePath } });
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
    await expect(readdir(filePath)).resolves.toEqual([]);
  });

  it.each([true, false])(
    'preserves cleanup failures alongside interruption (%s) or rendering failure',
    async interrupted => {
      const filePath = join(directory, 'report.txt');
      await writeFile(filePath, 'previous');
      const exit = await Effect.runPromise(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fileOutput = makeFileOutput(
            {
              ...fileSystem,
              makeTempFileScoped: options =>
                fileSystem
                  .makeTempFileScoped(options)
                  .pipe(Effect.tap(() => Effect.addFinalizer(() => Effect.die(new Error('cleanup failed')))))
            },
            path
          );
          const started = yield* Deferred.make<void>();
          const content = Stream.concat(
            Stream.make('incomplete'),
            Stream.fromEffect(
              Deferred.succeed(started, undefined).pipe(
                Effect.zipRight(interrupted ? Effect.never : Effect.die(new Error('render failed')))
              )
            )
          );
          const fiber = yield* Effect.fork(fileOutput.writeFile(directory, 'report.txt', content));
          yield* Deferred.await(started);
          return yield* interrupted ? Fiber.interrupt(fiber) : Fiber.await(fiber);
        }).pipe(Effect.provide(NodeFileOutputPlatformLayer))
      );

      const cause = Exit.match(exit, { onFailure: cause => cause, onSuccess: () => Cause.empty });
      const details = Cause.failureOption(cause).pipe(
        Option.match({ onNone: () => Cause.pretty(cause), onSome: error => error.cause ?? error.message })
      );
      expect(exit._tag).toBe('Failure');
      expect(Cause.isInterrupted(cause)).toBe(interrupted);
      expect(details).toContain('cleanup failed');
      expect(details).toContain(interrupted ? 'cleanup failed' : 'render failed');
      await expect(readFile(filePath, 'utf8')).resolves.toBe('previous');
      await expect(readdir(directory)).resolves.toEqual(['report.txt']);
    }
  );

  it('waits for an in-flight commit before reporting interruption', async () => {
    const filePath = join(directory, 'report.txt');
    await writeFile(filePath, 'previous');
    const started = await Effect.runPromise(Deferred.make<void>());
    const finish = await Effect.runPromise(Deferred.make<void>());
    const write = Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      return yield* makeFileOutput(
        {
          ...fileSystem,
          rename: (from, to) =>
            Deferred.succeed(started, undefined).pipe(
              Effect.zipRight(Deferred.await(finish)),
              Effect.zipRight(fileSystem.rename(from, to))
            )
        },
        path
      ).writeFile(directory, 'report.txt', Stream.make('complete'));
    }).pipe(Effect.provide(NodeFileOutputPlatformLayer));
    const fiber = Effect.runFork(write);
    try {
      await Effect.runPromise(Deferred.await(started));
      await Effect.runPromise(Fiber.interruptFork(fiber));
      expect(await Effect.runPromise(Fiber.poll(fiber))).toEqual(Option.none());
      await expect(readFile(filePath, 'utf8')).resolves.toBe('previous');
    } finally {
      await Effect.runPromise(Deferred.succeed(finish, undefined));
      await Effect.runPromise(Fiber.await(fiber));
    }
    const exit = await Effect.runPromise(Fiber.await(fiber));
    expect(Exit.isFailure(exit) && Cause.isInterruptedOnly(exit.cause)).toBe(true);
    await expect(readFile(filePath, 'utf8')).resolves.toBe('complete');
    await expect(readdir(directory)).resolves.toEqual(['report.txt']);
  });

  it.each([true, false])('interruption preserves previous output and cleans staging (existing: %s)', async existing => {
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
    await expect(readdir(directory)).resolves.toEqual(existing ? ['report.txt'] : []);
    if (existing) await expect(readFile(filePath, 'utf8')).resolves.toBe('previous');
  });
});
