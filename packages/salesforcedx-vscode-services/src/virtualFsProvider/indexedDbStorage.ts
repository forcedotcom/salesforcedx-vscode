/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs } from '@salesforce/core/fs';
import { Context, Effect, Layer } from 'effect';
import { Buffer } from 'node:buffer';
import { dirname } from 'node:path';
import * as vscode from 'vscode';
import { WebSdkLayer } from '../observability/spans';
import { ChannelService } from '../vscode/channelService';
import {
  isSerializedDirectoryWithPath,
  isSerializedFileWithPath,
  SerializedEntry,
  SerializedEntryWithPath,
  SerializedFileWithPath
} from './fsTypes';

const DB_NAME = 'fsProviderDB';
const STORE_NAME = 'files';
const DB_VERSION = 1;

export type IndexedDBStorageService = {
  /** Initialize the IndexedDB database */
  readonly initDB: Effect.Effect<void, Error, ChannelService>;
  /** Load state from IndexedDB into memfs */
  readonly loadState: Effect.Effect<void, Error, ChannelService>;
  /** Save a file to IndexedDB */
  readonly saveFile: (path: string) => Effect.Effect<void, Error, ChannelService>;
  /** Delete a file from IndexedDB */
  readonly deleteFile: (path: string) => Effect.Effect<void, Error, ChannelService>;
  /** Load a specific file from IndexedDB */
  readonly loadFile: (path: string) => Effect.Effect<void, Error, ChannelService>;
};

export const IndexedDBStorageService = Context.GenericTag<IndexedDBStorageService>('IndexedDBStorageService');

export const IndexedDBStorageServiceLive: Layer.Layer<IndexedDBStorageService, Error, ChannelService> = Layer.scoped(
  IndexedDBStorageService,
  Effect.gen(function* () {
    // Initialize the database once at service creation time
    const channelService = yield* ChannelService;
    const database = yield* Effect.tryPromise({
      try: async (): Promise<IDBDatabase> => {
        channelService.appendToChannel(`IndexedDBStorage initDB ${Date.now()}`);
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onerror = (): void => {
            channelService.appendToChannel('IndexedDB error');
            reject(request.error);
          };

          request.onsuccess = (): void => {
            channelService.appendToChannel(`IndexedDB initialized ${Date.now()}`);
            resolve(request.result);
          };

          request.onupgradeneeded = (event): void => {
            channelService.appendToChannel(`indexedDB upgraded from ${event.oldVersion} to ${event.newVersion}`);
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const upgradeDB = (event.target as IDBOpenDBRequest).result;
            if (!upgradeDB.objectStoreNames.contains(STORE_NAME)) {
              upgradeDB.createObjectStore(STORE_NAME, { keyPath: 'path' });
            }
          };
        });
        return db;
      },
      catch: (error: unknown) => new Error(`Failed to initialize IndexedDB: ${String(error)}`)
    }).pipe(Effect.withSpan('initDB'));

    const initDB = Effect.succeed(undefined);

    const loadState = Effect.tryPromise({
      try: async (): Promise<void> => {
        channelService.appendToChannel('indexedDBStorage loadState');
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        await new Promise<void>((resolve, reject) => {
          request.onsuccess = (): void => {
            channelService.appendToChannel('loadState success');
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const entries = request.result as SerializedEntryWithPath[];
            entries.filter(isSerializedDirectoryWithPath).forEach(entry => {
              fs.mkdirSync(entry.path, { recursive: true });
            });
            entries.filter(isSerializedFileWithPath).forEach(writeFileWithOrWithoutDir);
            channelService.appendToChannel('loadState completed');
            resolve();
          };
          request.onerror = (): void => reject(request.error);
        });
      },
      catch: (error: unknown) => new Error(`Failed to load state: ${String(error)}`)
    }).pipe(Effect.withSpan('loadState'), Effect.provide(WebSdkLayer));

    const saveFile = (path: string): Effect.Effect<void, Error, ChannelService> =>
      Effect.tryPromise({
        try: async (): Promise<void> => {
          const stats = fs.statSync(path);
          const entry: SerializedEntry & { path: string } = {
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

          await new Promise<void>((resolve, reject) => {
            const request = getObjectStore(database, 'readwrite').put(entry);
            request.onsuccess = (): void => resolve();
            request.onerror = (): void => reject(request.error);
          });
        },
        catch: (error: unknown) => new Error(`Failed to save file ${path}: ${String(error)}`)
      }).pipe(Effect.withSpan('saveFile', { attributes: { path } }), Effect.provide(WebSdkLayer));

    const deleteFile = (path: string): Effect.Effect<void, Error, ChannelService> =>
      Effect.tryPromise({
        try: async (): Promise<void> => {
          await new Promise<void>((resolve, reject) => {
            const request = getObjectStore(database, 'readwrite').delete(path);
            request.onsuccess = (): void => resolve();
            request.onerror = (): void => reject(request.error);
          });
        },
        catch: (error: unknown) => new Error(`Failed to delete file ${path}: ${String(error)}`)
      }).pipe(Effect.withSpan('deleteFile', { attributes: { path } }), Effect.provide(WebSdkLayer));

    const loadFile = (path: string): Effect.Effect<void, Error, ChannelService> =>
      Effect.tryPromise({
        try: async (): Promise<void> => {
          await new Promise<void>((resolve, reject) => {
            const request = getObjectStore(database, 'readonly').get(path);
            request.onsuccess = (): void => {
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              const entry = request.result as SerializedEntryWithPath;
              if (!entry) {
                resolve();
                return;
              }

              if (isSerializedFileWithPath(entry)) {
                writeFileWithOrWithoutDir(entry);
              } else {
                fs.mkdirSync(entry.path, { recursive: true });
              }
              resolve();
            };
            request.onerror = (): void => reject(request.error);
          });
        },
        catch: (error: unknown) => new Error(`Failed to load file ${path}: ${String(error)}`)
      }).pipe(Effect.withSpan('loadFile', { attributes: { path } }), Effect.provide(WebSdkLayer));

    return {
      initDB,
      loadState,
      saveFile,
      deleteFile,
      loadFile
    };
  })
);

const getObjectStore = (db: IDBDatabase, mode: 'readwrite' | 'readonly'): IDBObjectStore => {
  const transaction = db.transaction(STORE_NAME, mode);
  const store = transaction.objectStore(STORE_NAME);
  return store;
};

const writeFileWithOrWithoutDir = (entry: SerializedFileWithPath): void => {
  fs.mkdirSync(dirname(entry.path), { recursive: true });
  fs.writeFileSync(entry.path, Buffer.from(entry.data, 'base64'));
};
