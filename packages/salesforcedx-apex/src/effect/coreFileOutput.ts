/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs } from '@salesforce/core/fs';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { createWriteStream } from 'node:fs';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { FileOutputError, type FileOutput } from './fileOutput.js';

const toFileOutputError = (operation: string, filePath: string, cause: unknown) =>
  new FileOutputError({ operation, path: filePath, message: cause instanceof Error ? cause.message : String(cause) });

/** Promise adapter used by the legacy TestService; the host's fs facade selects Node fs or web memfs. */
export const CoreFileOutput: typeof FileOutput.Service = {
  createDirectory: Effect.fn('CoreFileOutput.createDirectory')((directory: string) =>
    Effect.tryPromise({
      try: () => fs.promises.mkdir(directory, { recursive: true }).then(() => undefined),
      catch: cause => toFileOutputError('createDirectory', directory, cause)
    })
  ),
  writeFile: Effect.fn('CoreFileOutput.writeFile')(
    (directory: string, fileName: string, content: Stream.Stream<string>) => {
      const filePath = path.join(directory, fileName);
      return Effect.tryPromise({
        try: async signal => {
          const tempDirectory = await fs.promises.mkdtemp(path.join(directory, '.apex-result-'));
          const tempPath = path.join(tempDirectory, 'output');
          try {
            await pipeline(Stream.toAsyncIterable(content), createWriteStream(tempPath), { signal });
            await fs.promises.rename(tempPath, filePath);
            return filePath;
          } finally {
            await fs.promises.rm(tempDirectory, { recursive: true, force: true });
          }
        },
        catch: cause => toFileOutputError('writeFile', filePath, cause)
      });
    }
  )
};
