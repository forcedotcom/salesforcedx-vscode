/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Global } from '@salesforce/core';
import { fs } from '@salesforce/core/fs';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { Buffer } from 'node:buffer';
import { dirname } from 'node:path';
import * as vscode from 'vscode';
import { SdkLayer } from '../observability/spans';
import {
  isSerializedDirectoryWithPath,
  isSerializedFileWithPath,
  SerializedEntryWithPath,
  SerializedFileWithPath
} from './fsTypes';

const DB_NAME = 'fsProviderDB';
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
    const db = yield* Effect.async<IDBDatabase, Error>(resume => {
      const openRequest = indexedDB.open(DB_NAME, DB_VERSION);

      openRequest.onupgradeneeded = (event): void => {
        const dbToUpgrade = ensureOpenRequestEvent(event).target.result;
        if (!dbToUpgrade.objectStoreNames.contains(STORE_NAME)) {
          dbToUpgrade.createObjectStore(STORE_NAME);
        }
      };

      openRequest.onsuccess = (event: Event): void => {
        resume(Effect.succeed(ensureOpenRequestEvent(event).target.result));
      };

      openRequest.onerror = (event: unknown): void => {
        resume(Effect.fail(new Error(`Failed to open IndexedDB database "${DB_NAME}" with error: ${String(event)}`)));
      };
    });

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        db.close();
      })
    );

    const withStore = <A>(
      mode: IDBTransactionMode,
      f: (store: IDBObjectStore) => IDBRequest<A>
    ): Effect.Effect<A, Error> =>
      Effect.async<A, Error>(resume => {
        // eslint-disable-next-line functional/no-try-statements
        try {
          const transaction = db.transaction(STORE_NAME, mode);
          const store = transaction.objectStore(STORE_NAME);
          const request = f(store);

          request.onsuccess = (): void => {
            resume(Effect.succeed(request.result));
          };

          request.onerror = (): void => {
            resume(
              Effect.fail(
                new Error(`Transaction failed with mode "${mode}" with cause: ${String(request.error)}`, {
                  cause: request.error
                })
              )
            );
          };
        } catch (error) {
          resume(
            Effect.fail(
              new Error(`Transaction failed with mode "${mode}" with cause: ${String(error)}`, { cause: error })
            )
          );
        }
      });

    const loadState = (): Effect.Effect<void, Error> =>
      withStore('readonly', store => store.getAll()).pipe(
        Effect.tap((entries: SerializedEntryWithPath[]) => {
          entries.filter(isSerializedDirectoryWithPath).forEach(entry => {
            fs.mkdirSync(entry.path, { recursive: true });
          });
          entries.filter(isSerializedFileWithPath).forEach(writeFileWithOrWithoutDir);
        }),
        Effect.tap(entries => Effect.annotateCurrentSpan({ entries })),
        Effect.withSpan('loadState'),
        Effect.provide(SdkLayer)
      );

    const saveFile = (path: string): Effect.Effect<void, Error> =>
      // Provide the key explicitly since the store uses out-of-line keys
      withStore('readwrite', store => store.put(buildFileEntry(path), path)).pipe(
        Effect.withSpan('saveFile', { attributes: { path } }),
        Effect.provide(SdkLayer)
      );

    const deleteFile = (path: string): Effect.Effect<void, Error> =>
      withStore('readwrite', store => store.delete(path)).pipe(
        Effect.withSpan('deleteFile', { attributes: { path } }),
        Effect.provide(SdkLayer)
      );

    const loadFile = (path: string): Effect.Effect<void, Error> =>
      withStore<SerializedEntryWithPath | undefined>('readonly', store => store.get(path)).pipe(
        Effect.tap(entry => {
          if (!entry) {
            return;
          }
          if (isSerializedFileWithPath(entry)) {
            writeFileWithOrWithoutDir(entry);
          } else {
            fs.mkdirSync(entry.path, { recursive: true });
          }
        }),
        Effect.withSpan('loadFile', { attributes: { path } }),
        Effect.provide(SdkLayer)
      );

    const getAllEntries = (): Effect.Effect<SerializedEntryWithPath[], Error> =>
      withStore('readonly', store => store.getAll()).pipe(
        Effect.withSpan('getAllEntries'),
        Effect.provide(SdkLayer)
      );

    return {
      /** Load state from IndexedDB into memfs */
      loadState,
      /** Save a file to IndexedDB */
      saveFile,
      /** Delete a file from IndexedDB */
      deleteFile,
      /** Load a specific file from IndexedDB */
      loadFile,
      /** Get all entries from IndexedDB */
      getAllEntries
    } as const;
  })
}) { }

// Noop implementation for non-web environments
const IndexedDBStorageServicesNoop: Layer.Layer<IndexedDBStorageService, never> = Layer.succeed(
  IndexedDBStorageService,
  new IndexedDBStorageService({
    loadState: () => Effect.succeed(undefined),
    saveFile: () => Effect.succeed(undefined),
    deleteFile: () => Effect.succeed(undefined),
    loadFile: () => Effect.succeed(undefined),
    getAllEntries: () => Effect.succeed([])
  })
);

// Expose a single, memoized layer instance to ensure one shared IndexedDB connection only if web.  Otherwise, use a dummy layer.
export const IndexedDBStorageServiceShared = Global.isWeb
  ? Layer.unwrapEffect(Layer.memoize(IndexedDBStorageService.Default))
  : IndexedDBStorageServicesNoop;

const writeFileWithOrWithoutDir = (entry: SerializedFileWithPath): void => {
  fs.mkdirSync(dirname(entry.path), { recursive: true });
  fs.writeFileSync(entry.path, Buffer.from(entry.data, 'base64'));
};

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
        data: fs.readFileSync(path).toString('base64'),
        type: vscode.FileType.File
      })
  };
};
