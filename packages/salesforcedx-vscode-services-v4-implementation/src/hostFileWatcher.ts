/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  HostFileNotFoundError,
  HostFileWatchError,
  HostFileWatcher,
  type FileChangeEvent
} from '@salesforce/vscode-services-v2';
import * as Cause from 'effect/Cause';
import * as Context from 'effect/Context';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import { isNotUndefined, isString, isTagged } from 'effect/Predicate';
import * as Queue from 'effect/Queue';
import * as Schedule from 'effect/Schedule';
import * as Stream from 'effect/Stream';
import { unknownToErrorCause } from './errorCause.js';
import { HostFileSystem } from './hostFileSystem.js';
import { toUri } from './uriUtils.js';

type WatchFailure = HostFileNotFoundError | HostFileWatchError;
/** Internal acquisition receipt for scoped connection-watcher startup. Missing files retry in scope. */
export const HostFileWatchReady = Context.Reference<Option.Option<Deferred.Deferred<void, WatchFailure>>>(
  '@salesforce/vscode-services-v4-implementation/HostFileWatchReady',
  { defaultValue: Option.none }
);
const watchFailure = (error: unknown, path: string): WatchFailure => {
  const { cause, message } = unknownToErrorCause(error);
  const code = 'code' in cause && isString(cause.code) ? cause.code : undefined;
  return code === 'ENOENT'
    ? new HostFileNotFoundError({ message, path })
    : new HostFileWatchError({ message, path, ...(isNotUndefined(code) ? { code } : {}) });
};

export const HostFileWatcherLayer = Layer.effect(
  HostFileWatcher,
  Effect.gen(function* () {
    const hostFs = yield* HostFileSystem;
    const watch = (filePath: string) =>
      Stream.callback<FileChangeEvent, WatchFailure>(queue =>
        Effect.acquireRelease(
          Effect.try({
            try: () => {
              const watcher = hostFs.get().watch(filePath, () => {
                Queue.offerUnsafe(queue, { type: 'change', uri: toUri(filePath) });
              });
              watcher.on('error', (error: unknown) => {
                Queue.failCauseUnsafe(queue, Cause.fail(watchFailure(error, filePath)));
              });
              return watcher;
            },
            catch: error => watchFailure(error, filePath)
          }),
          // Both SDK backends support close(); memfs does not emit Node's 'close' event.
          watcher => Effect.sync(() => watcher.close())
        ).pipe(
          Effect.onExit(exit =>
            HostFileWatchReady.pipe(
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.void,
                  onSome: ready => {
                    if (Exit.isSuccess(exit)) return Deferred.succeed(ready, undefined);
                    const watchError = exit.cause.reasons.find(
                      reason => reason._tag === 'Fail' && reason.error._tag === 'HostFileWatchError'
                    );
                    if (watchError?._tag === 'Fail' && watchError.error._tag === 'HostFileWatchError')
                      return Deferred.fail(ready, watchError.error);
                    return exit.cause.reasons.some(
                      reason => reason._tag === 'Fail' && reason.error._tag === 'HostFileNotFoundError'
                    )
                      ? Deferred.succeed(ready, undefined)
                      : Deferred.done(ready, exit);
                  }
                })
              )
            )
          )
        )
      ).pipe(
        Stream.retry(
          Schedule.spaced(Duration.millis(250)).pipe(
            Schedule.while(({ input }) => isTagged('HostFileNotFoundError')(input))
          )
        ),
        Stream.withSpan('HostFileWatcher.watch', { attributes: { path: filePath } })
      );
    return HostFileWatcher.of({ watch });
  })
);
