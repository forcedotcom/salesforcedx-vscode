/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fs } from '@salesforce/core/fs';
import * as Effect from 'effect/Effect';
import * as Encoding from 'effect/Encoding';
import * as Layer from 'effect/Layer';
import { Buffer } from 'node:buffer';
import { dirname } from 'node:path';
import * as vscode from 'vscode';
import { CODE_BUILDER_WEB_SECTION, INSTANCE_URL_KEY } from '../constants';
import { unknownToErrorCause } from '../core/shared';
import {
  isSerializedDirectoryWithPath,
  isSerializedFileWithPath,
  SerializedEntryWithPath,
  SerializedFileWithPath
} from './fsTypes';
import { settleIdbTransaction } from './idbTransaction';
import { VirtualFsProviderError } from './virtualFsProviderError';

const STORE_NAME = 'files';
const DB_VERSION = 1;

const isOpenRequestEvent = (event: Event): event is Event & { target: IDBOpenDBRequest } =>
  event.target instanceof IDBOpenDBRequest;

const ensureOpenRequestEvent = (event: Event): Event & { target: IDBOpenDBRequest } => {
  if (!isOpenRequestEvent(event)) {
    // eslint-disable-next-line functional/no-throw-statements
    throw new Error('Invalid event target for IndexedDB open request');
  }
  return event;
};

export class IndexedDBStorageService extends Effect.Service<IndexedDBStorageService>()('IndexedDBStorageService', {
  scoped: Effect.gen(function* () {
    const dbName =
      vscode.workspace.getConfiguration(CODE_BUILDER_WEB_SECTION).get<string>(INSTANCE_URL_KEY)?.trim() ?? 'default';

    const db = yield* Effect.async<IDBDatabase, VirtualFsProviderError>(resume => {
      const openRequest = indexedDB.open(dbName, DB_VERSION);

      openRequest.onupgradeneeded = (event): void => {
        const dbToUpgrade = ensureOpenRequestEvent(event).target.result;
        if (!dbToUpgrade.objectStoreNames.contains(STORE_NAME)) {
          dbToUpgrade.createObjectStore(STORE_NAME);
        }
      };

      openRequest.onsuccess = (event: Event): void => {
        resume(Effect.succeed(ensureOpenRequestEvent(event).target.result));
      };

      openRequest.onerror = (): void => {
        resume(
          Effect.fail(
            new VirtualFsProviderError({
              ...unknownToErrorCause(openRequest.error),
              message: `Failed to open IndexedDB database "${dbName}"`
            })
          )
        );
      };
    });

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        db.close();
      })
    );

    const withStore = <A>(mode: IDBTransactionMode, f: (store: IDBObjectStore) => IDBRequest<A>) =>
      Effect.suspend(() => {
        // eslint-disable-next-line functional/no-try-statements
        try {
          const transaction = db.transaction(STORE_NAME, mode);
          return settleIdbTransaction(transaction, f(transaction.objectStore(STORE_NAME)), mode);
        } catch (error: unknown) {
          return Effect.fail(
            new VirtualFsProviderError({
              ...unknownToErrorCause(error),
              message: `Transaction failed with mode "${mode}"`
            })
          );
        }
      });

    const loadState = () =>
      withStore('readonly', store => store.getAll()).pipe(
        Effect.tap((entries: SerializedEntryWithPath[]) =>
          Effect.gen(function* () {
            yield* Effect.forEach(
              entries.filter(isSerializedDirectoryWithPath),
              entry => restoreDirectory(entry.path),
              { discard: true }
            );
            yield* Effect.forEach(entries.filter(isSerializedFileWithPath), writeFileWithOrWithoutDir, {
              discard: true
            });
          })
        ),
        Effect.tap(entries => Effect.annotateCurrentSpan({ entries })),
        Effect.withSpan('loadState')
      );

    const saveFile = (path: string) =>
      // Provide the key explicitly since the store uses out-of-line keys
      withStore('readwrite', store => store.put(buildFileEntry(path), path)).pipe(
        Effect.withSpan('saveFile', { attributes: { path } })
      );

    const deleteFile = (path: string) =>
      withStore('readwrite', store => store.delete(path)).pipe(
        Effect.asVoid,
        Effect.withSpan('deleteFile', { attributes: { path } })
      );

    const loadFile = (path: string) =>
      withStore<SerializedEntryWithPath | undefined>('readonly', store => store.get(path)).pipe(
        Effect.tap(entry => {
          if (!entry) {
            return Effect.void;
          }
          if (isSerializedFileWithPath(entry)) {
            return writeFileWithOrWithoutDir(entry);
          }
          return restoreDirectory(entry.path);
        }),
        Effect.asVoid,
        Effect.withSpan('loadFile', { attributes: { path } })
      );
    return {
      /** Load state from IndexedDB into memfs */
      loadState,
      /** Save a file to IndexedDB */
      saveFile,
      /** Delete a file from IndexedDB */
      deleteFile,
      /** Load a specific file from IndexedDB */
      loadFile
    };
  })
}) {}

// Noop implementation for non-web environments
const IndexedDBStorageServicesNoop: Layer.Layer<IndexedDBStorageService, never> = Layer.succeed(
  IndexedDBStorageService,
  new IndexedDBStorageService({
    loadState: () => Effect.succeed([]),
    saveFile: () => Effect.succeed('foo'),
    deleteFile: () => Effect.void,
    loadFile: () => Effect.void
  })
);

// Expose a single, memoized layer instance to ensure one shared IndexedDB connection only if web.  Otherwise, use a dummy layer.
export const IndexedDBStorageServiceShared =
  process.env.ESBUILD_PLATFORM === 'web'
    ? IndexedDBStorageService.Default.pipe(Layer.memoize, Layer.unwrapEffect)
    : IndexedDBStorageServicesNoop;

const restoreDirectory = Effect.fn('IndexedDBStorageService.restoreDirectory')(function* (path: string) {
  yield* Effect.try({
    try: () => fs.mkdirSync(path, { recursive: true }),
    catch: error =>
      new VirtualFsProviderError({
        ...unknownToErrorCause(error),
        message: `Failed to restore directory "${path}"`,
        path
      })
  });
});

const writeFileWithOrWithoutDir = Effect.fn('IndexedDBStorageService.writeFileWithOrWithoutDir')(function* (
  entry: SerializedFileWithPath
) {
  const data = yield* Encoding.decodeBase64(entry.data).pipe(
    Effect.mapError(
      error =>
        new VirtualFsProviderError({
          ...unknownToErrorCause(error),
          message: `Failed to decode restored file "${entry.path}"`,
          path: entry.path
        })
    )
  );
  yield* Effect.try({
    try: () => {
      fs.mkdirSync(dirname(entry.path), { recursive: true });
      fs.writeFileSync(entry.path, Buffer.from(data));
    },
    catch: error =>
      new VirtualFsProviderError({
        ...unknownToErrorCause(error),
        message: `Failed to restore file "${entry.path}"`,
        path: entry.path
      })
  });
});

const buildFileEntry = (path: string): SerializedEntryWithPath => {
  const stats = fs.statSync(path);
  return {
    path,
    ctime: stats.ctimeMs,
    mtime: stats.mtimeMs,
    size: stats.size,
    ...(stats.isDirectory()
      ? { entries: {}, type: vscode.FileType.Directory }
      : {
          // Use base64 to preserve binary data (e.g., git objects)
          data: Encoding.encodeBase64(fs.readFileSync(path)),
          type: vscode.FileType.File
        })
  };
};
