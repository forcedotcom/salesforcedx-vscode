/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as path from 'node:path';
import { FileOutput } from '../effect/fileOutput';

/** Writes a file through the caller-provided output implementation. */
export const createFile = Effect.fn('Apex.createFile')(function* (filePath: string, fileContent: string) {
  const fileOutput = yield* FileOutput;
  const directory = path.dirname(filePath);
  yield* fileOutput.createDirectory(directory);
  return yield* fileOutput.writeFile(directory, path.basename(filePath), Stream.make(fileContent));
});
