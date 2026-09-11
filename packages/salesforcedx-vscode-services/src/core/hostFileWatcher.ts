/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FileChangeEvent } from '../vscode/fileChangePubSub';
import { fs } from '@salesforce/core/fs';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isNotUndefined, isString, isTagged } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { URI } from 'vscode-uri';
import { unknownToErrorCause } from './shared';

export class HostFileNotFoundError extends Schema.TaggedError<HostFileNotFoundError>()('HostFileNotFoundError', {
  message: Schema.String,
  path: Schema.String
}) {}

export class HostFileWatchError extends Schema.TaggedError<HostFileWatchError>()('HostFileWatchError', {
  message: Schema.String,
  path: Schema.String,
  code: Schema.optional(Schema.String)
}) {}

type HostFileWatchFailure = HostFileNotFoundError | HostFileWatchError;

const toWatchError = (error: unknown, path: string): HostFileWatchFailure => {
  const { cause, message } = unknownToErrorCause(error);
  const code = 'code' in cause && isString(cause.code) ? cause.code : undefined;
  return code === 'ENOENT'
    ? new HostFileNotFoundError({ message, path })
    : new HostFileWatchError({ message, path, ...(isNotUndefined(code) ? { code } : {}) });
};

/** Watch a host-FS file (not a workspace path). Uses `@salesforce/core/fs` (node on desktop, memfs on web). */
const watchHostFile = (filePath: string): Stream.Stream<FileChangeEvent, HostFileWatchFailure> =>
  Stream.unwrap(
    Effect.try({
      try: () => fs.promises.watch(filePath),
      catch: error => toWatchError(error, filePath)
    }).pipe(
      Effect.map(iterable =>
        Stream.fromAsyncIterable(iterable, error => toWatchError(error, filePath)).pipe(
          Stream.map(
            (): FileChangeEvent => ({
              type: 'change',
              uri: URI.file(filePath)
            })
          )
        )
      )
    )
  ).pipe(
    Stream.retry(Schedule.spaced(Duration.millis(250)).pipe(Schedule.whileInput(isTagged('HostFileNotFoundError')))),
    Stream.withSpan('HostFileWatcher.watch', { attributes: { path: filePath } })
  );

export class HostFileWatcher extends Effect.Service<HostFileWatcher>()('HostFileWatcher', {
  effect: Effect.succeed({
    watch: watchHostFile
  })
}) {}
