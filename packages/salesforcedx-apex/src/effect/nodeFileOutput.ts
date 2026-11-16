/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as Sink from 'effect/Sink';
import * as Stream from 'effect/Stream';
import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import * as path from 'node:path';
import { causeMessage } from './errors';
import { FileOutput, FileOutputError } from './fileOutput';

const toFileOutputError = (operation: string, filePath: string, cause: unknown): FileOutputError =>
  new FileOutputError({ operation, path: filePath, message: causeMessage(cause), cause: causeMessage(cause) });

const fileOperation = <A>(operation: string, filePath: string, run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: cause => toFileOutputError(operation, filePath, cause) });

const writeChunk = Effect.fn('NodeFileOutput.writeChunk')(function* (
  file: FileHandle,
  filePath: string,
  chunk: string
) {
  const bytes = Buffer.from(chunk, 'utf8');
  yield* Effect.iterate(0, {
    while: offset => offset < bytes.length,
    body: offset =>
      fileOperation('writeFile', filePath, () => file.write(bytes, offset, bytes.length - offset)).pipe(
        Effect.uninterruptible,
        Effect.flatMap(({ bytesWritten }) =>
          bytesWritten > 0
            ? Effect.succeed(offset + bytesWritten)
            : Effect.fail(
                new FileOutputError({ operation: 'writeFile', path: filePath, message: 'File write made no progress' })
              )
        )
      )
  });
});

/** Node-shaped filesystem contract, including web memfs substitution: see Apex ADR 0003. */
export const NodeFileOutput: typeof FileOutput.Service = {
  createDirectory: Effect.fn('NodeFileOutput.createDirectory')((directory: string) =>
    fileOperation('createDirectory', directory, () => fs.mkdir(directory, { recursive: true })).pipe(Effect.asVoid)
  ),
  writeFile: Effect.fn('NodeFileOutput.writeFile')(function* (
    directory: string,
    fileName: string,
    content: Stream.Stream<string>
  ) {
    const filePath = path.join(directory, fileName);
    const stagedPath = path.join(path.dirname(filePath), `.apex-result-${randomBytes(16).toString('hex')}`);
    return yield* Effect.acquireUseRelease(
      fileOperation('open', filePath, () => fs.open(stagedPath, 'wx')),
      file =>
        content.pipe(
          // Batch small formatter fragments with bounded buffering and stream backpressure.
          Stream.transduce(
            Sink.foldWeighted({
              initial: '',
              maxCost: 64 * 1024,
              cost: (_: string, chunk: string) => Buffer.byteLength(chunk, 'utf8'),
              body: (buffer, chunk) => buffer + chunk
            })
          ),
          Stream.runForEach(chunk => writeChunk(file, filePath, chunk)),
          Effect.zipRight(fileOperation('close', filePath, () => file.close())),
          Effect.zipRight(
            fileOperation('rename', filePath, () => fs.rename(stagedPath, filePath)).pipe(Effect.uninterruptible)
          ),
          Effect.as(filePath)
        ),
      (file, exit) =>
        // close is idempotent; this also covers interruption immediately after open.
        fileOperation('close', filePath, () => file.close()).pipe(
          Effect.orDie,
          Effect.ensuring(
            Exit.isSuccess(exit)
              ? Effect.void
              : fileOperation('removeTempFile', filePath, () => fs.rm(stagedPath, { force: true })).pipe(Effect.orDie)
          )
        )
    ).pipe(
      Effect.catchAllCause(cause => {
        if (Cause.isInterrupted(cause)) return Effect.failCause(cause);
        const error = Cause.squash(cause);
        return Effect.fail(Schema.is(FileOutputError)(error) ? error : toFileOutputError('writeFile', filePath, error));
      })
    );
  })
};

export const NodeFileOutputLayer = Layer.succeed(FileOutput, NodeFileOutput);
