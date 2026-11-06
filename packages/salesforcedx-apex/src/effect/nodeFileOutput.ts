/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { FileOutput, FileOutputError } from './fileOutput';

const toFileOutputError = (operation: string, filePath: string, cause: unknown): FileOutputError =>
  new FileOutputError({ operation, path: filePath, message: cause instanceof Error ? cause.message : String(cause) });

/** Node implementation. Writes streams to disk without collecting the full report in memory. */
export const NodeFileOutput: typeof FileOutput.Service = {
  createDirectory: Effect.fn('NodeFileOutput.createDirectory')((directory: string) =>
    Effect.tryPromise({
      try: () => mkdir(directory, { recursive: true }).then(() => undefined),
      catch: cause => toFileOutputError('createDirectory', directory, cause)
    })
  ),
  writeFile: Effect.fn('NodeFileOutput.writeFile')(
    (directory: string, fileName: string, content: Stream.Stream<string, never, never>) => {
      const filePath = path.join(directory, fileName);
      return Effect.tryPromise({
        try: () => pipeline(Stream.toAsyncIterable(content), createWriteStream(filePath)).then(() => filePath),
        catch: cause => toFileOutputError('writeFile', filePath, cause)
      });
    }
  )
};

export const NodeFileOutputLayer = Layer.succeed(FileOutput, NodeFileOutput);
