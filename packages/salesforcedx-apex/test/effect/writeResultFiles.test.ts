/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Cause from 'effect/Cause';
import * as Deferred from 'effect/Deferred';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import * as Stream from 'effect/Stream';
import { FileOutput, FileOutputError } from '../../src/effect/fileOutput';
import { writeResultFiles } from '../../src/effect/writeResultFiles';
import { NodeFileOutputPlatformLayer } from '../../src/effect/nodeFileOutputLayer';
import { successResult } from '../reporters/testResults';

const createMemoryFileOutput = (files: Map<string, string>): typeof FileOutput.Service => ({
  createDirectory: () => Effect.void,
  writeFile: (directory, fileName, content) =>
    Stream.runCollect(content).pipe(
      Effect.map(Chunk.join('')),
      Effect.map(content => {
        const path = `${directory}/${fileName}`;
        files.set(path, content);
        return path;
      })
    )
});

describe('Effect writeResultFiles', () => {
  it('writes compact JSON and coverage files through the provided file output', async () => {
    const files = new Map<string, string>();
    const fileOutput = createMemoryFileOutput(files);
    const result = {
      ...successResult,
      summary: { ...successResult.summary, testRunId: undefined },
      tests: [],
      codecoverage: undefined
    };

    const written = await Effect.runPromise(
      writeResultFiles(result, { dirPath: '/reports', resultFormats: ['json'] }, { codeCoverage: true }).pipe(
        Effect.provide(NodeFileOutputPlatformLayer),
        Effect.provideService(FileOutput, fileOutput)
      )
    );

    expect(written).toEqual(['/reports/test-result-default.json', '/reports/test-result-default-codecoverage.json']);
    expect(files.get('/reports/test-result-default.json')).toBe(
      JSON.stringify({ summary: result.summary, tests: result.tests })
    );
    expect(files.get('/reports/test-result-default-codecoverage.json')).toBe('[]');
  });

  it('can include setup rows when the caller writes extension JSON', async () => {
    const files = new Map<string, string>();
    const result = {
      ...successResult,
      tests: [],
      setup: [
        {
          methodName: 'testSetup',
          apexClass: { name: 'SetupClass', fullName: 'SetupClass' },
          testSetupTime: 1,
          fullName: 'SetupClass.testSetup'
        }
      ],
      codecoverage: undefined
    };

    await Effect.runPromise(
      writeResultFiles(result, { dirPath: '/reports', resultFormats: ['json'] }, { includeSetup: true }).pipe(
        Effect.provide(NodeFileOutputPlatformLayer),
        Effect.provideService(FileOutput, createMemoryFileOutput(files))
      )
    );

    expect(files.get('/reports/test-result-7073t000061uwZI.json')).toBe(
      JSON.stringify({ summary: result.summary, tests: [], setup: result.setup })
    );
  });

  it('does not swallow a run ID write failure or start later writes', async () => {
    const writeFile = vi.fn(() =>
      Effect.fail(new FileOutputError({ operation: 'writeFile', path: '/reports/test-run-id.txt', message: 'denied' }))
    );
    const result = await Effect.runPromise(
      writeResultFiles(successResult, { dirPath: '/reports', resultFormats: ['json'] }).pipe(
        Effect.provide(NodeFileOutputPlatformLayer),
        Effect.provideService(FileOutput, { createDirectory: () => Effect.void, writeFile }),
        Effect.either
      )
    );

    expect(result).toMatchObject({ _tag: 'Left', left: { _tag: 'FileOutputError', message: 'denied' } });
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it('reports committed files when a later write fails', async () => {
    const files = new Map<string, string>();
    const memory = createMemoryFileOutput(files);
    const failure = new FileOutputError({ operation: 'writeFile', path: '/reports/extra.txt', message: 'disk full' });
    const result = await Effect.runPromise(
      writeResultFiles(successResult, {
        dirPath: '/reports',
        resultFormats: ['json'],
        fileInfos: [
          { filename: 'extra.txt', content: 'extra' },
          { filename: 'not-started.txt', content: 'later' }
        ]
      }).pipe(
        Effect.provide(NodeFileOutputPlatformLayer),
        Effect.provideService(FileOutput, {
          ...memory,
          writeFile: (directory, fileName, content) =>
            fileName === 'extra.txt' ? Effect.fail(failure) : memory.writeFile(directory, fileName, content)
        }),
        Effect.either
      )
    );

    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        _tag: 'PartialResultFilesError',
        writtenFiles: ['/reports/test-run-id.txt', '/reports/test-result-7073t000061uwZI.json'],
        cause: failure
      }
    });
    expect([...files.keys()]).toEqual(['/reports/test-run-id.txt', '/reports/test-result-7073t000061uwZI.json']);
  });

  it('reports serialization failure and the files already committed', async () => {
    const files = new Map<string, string>();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const result = await Effect.runPromise(
      writeResultFiles(successResult, {
        dirPath: '/reports',
        fileInfos: [{ filename: 'circular.json', content: circular }]
      }).pipe(
        Effect.provide(NodeFileOutputPlatformLayer),
        Effect.provideService(FileOutput, createMemoryFileOutput(files)),
        Effect.either
      )
    );

    expect(result).toMatchObject({
      _tag: 'Left',
      left: {
        _tag: 'PartialResultFilesError',
        writtenFiles: ['/reports/test-run-id.txt'],
        cause: { _tag: 'FileOutputError', operation: 'serialize', path: '/reports/circular.json' }
      }
    });
  });

  it('preserves interruption after a completed write without starting subsequent files', async () => {
    const files = new Map<string, string>();
    const memory = createMemoryFileOutput(files);
    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const fiber = yield* writeResultFiles(successResult, {
          dirPath: '/reports',
          resultFormats: ['json'],
          fileInfos: [{ filename: 'not-started.txt', content: 'later' }]
        }).pipe(
          Effect.provide(NodeFileOutputPlatformLayer),
          Effect.provideService(FileOutput, {
            ...memory,
            writeFile: (directory, fileName, content) =>
              fileName.endsWith('.json')
                ? Deferred.succeed(started, undefined).pipe(Effect.zipRight(Effect.never))
                : memory.writeFile(directory, fileName, content)
          }),
          Effect.fork
        );
        yield* Deferred.await(started);
        return yield* Fiber.interrupt(fiber);
      })
    );

    expect(Exit.isFailure(exit) && Cause.isInterruptedOnly(exit.cause)).toBe(true);
    expect([...files.keys()]).toEqual(['/reports/test-run-id.txt']);
  });
});
