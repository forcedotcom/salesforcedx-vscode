/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import { Buffer } from 'node:buffer';
import { causeMessage } from './errors';
import { FileOutput, FileOutputError } from './fileOutput';

const toFileOutputError = (operation: string, filePath: string, cause: unknown): FileOutputError =>
  new FileOutputError({ operation, path: filePath, message: causeMessage(cause), cause: causeMessage(cause) });

export const makeFileOutput = (fileSystem: FileSystem.FileSystem, path: Path.Path): typeof FileOutput.Service => ({
  createDirectory: Effect.fn('NodeFileOutput.createDirectory')((directory: string) =>
    fileSystem
      .makeDirectory(directory, { recursive: true })
      .pipe(Effect.mapError(error => toFileOutputError('createDirectory', directory, error)))
  ),
  writeFile: Effect.fn('NodeFileOutput.writeFile')(function* (
    directory: string,
    fileName: string,
    content: Stream.Stream<string>
  ) {
    const filePath = path.join(directory, fileName);
    const write = Stream.run(
      Stream.encodeText(content).pipe(Stream.map(chunk => Buffer.from(chunk))),
      fileSystem.sink(filePath)
    ).pipe(Effect.mapError(error => toFileOutputError('writeFile', filePath, error)));
    return yield* write.pipe(
      Effect.onExit(exit =>
        Exit.isSuccess(exit)
          ? Effect.void
          : fileSystem.remove(filePath, { force: true }).pipe(Effect.catchAll(() => Effect.void))
      ),
      Effect.catchAllCause(cause =>
        Cause.isInterrupted(cause)
          ? Effect.failCause(cause)
          : Effect.fail(toFileOutputError('writeFile', filePath, Cause.squash(cause)))
      ),
      Effect.as(filePath)
    );
  })
});

/** Effect Platform-backed file output; failed or interrupted writes remove partial output. */
export const NodeFileOutput = {
  createDirectory: Effect.fn('NodeFileOutput.createDirectory')((directory: string) =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      return yield* makeFileOutput(fileSystem, path).createDirectory(directory);
    })
  ),
  writeFile: Effect.fn('NodeFileOutput.writeFile')(function* (
    directory: string,
    fileName: string,
    content: Stream.Stream<string>
  ) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* makeFileOutput(fileSystem, path).writeFile(directory, fileName, content);
  })
};

/** FileOutput implementation layer; callers provide Effect Platform FileSystem and Path services. */
export const FileOutputLayer = Layer.effect(
  FileOutput,
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return makeFileOutput(fileSystem, path);
  })
);
