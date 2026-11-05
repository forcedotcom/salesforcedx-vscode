/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileOutputError, type FileOutput } from '@salesforce/apex-node/effect';
import type { SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import * as Chunk from 'effect/Chunk';
import type * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import { Utils } from 'vscode-uri';

type FsServiceTag = SalesforceVSCodeServicesApi['services']['FsService'];
type FsService = Context.Tag.Service<FsServiceTag>;

const toFileOutputError = (operation: string, path: string, cause: unknown): FileOutputError =>
  new FileOutputError({ operation, path, message: isError(cause) ? cause.message : String(cause) });

/** Uses the services-owned filesystem, including its VS Code web workspace provider. */
export const fileOutputFromFsService = (fsService: FsService): typeof FileOutput.Service => ({
  createDirectory: Effect.fn('ApexTestingFileOutput.createDirectory')((path: string) =>
    fsService.createDirectory(path).pipe(Effect.mapError(cause => toFileOutputError('createDirectory', path, cause)))
  ),
  writeFile: Effect.fn('ApexTestingFileOutput.writeFile')(
    (directory: string, fileName: string, content: Stream.Stream<string, never, never>) =>
      Stream.runCollect(content).pipe(
        Effect.map(Chunk.toArray),
        Effect.map(chunks => chunks.join('')),
        Effect.flatMap(text =>
          fsService.toUri(directory).pipe(
            Effect.map(uri => Utils.joinPath(uri, fileName)),
            Effect.flatMap(fileUri => fsService.safeWriteFile(fileUri, text).pipe(Effect.as(fileUri.toString())))
          )
        ),
        Effect.mapError(cause => toFileOutputError('writeFile', `${directory}/${fileName}`, cause))
      )
  )
});
