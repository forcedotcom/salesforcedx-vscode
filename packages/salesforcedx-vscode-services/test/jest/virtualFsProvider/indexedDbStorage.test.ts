/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs, resetFs, setFs } from '@salesforce/core/fs';
import * as Effect from 'effect/Effect';
import { createFsFromVolume, Volume } from 'memfs';
import { Buffer } from 'node:buffer';
import * as vscode from 'vscode';
import { IndexedDBStorageService } from '../../../src/virtualFsProvider/indexedDbStorage';

const makeRequest = <T>(result: () => T, complete: () => void): IDBRequest<T> => {
  const request = {
    error: null,
    result: undefined as T,
    onerror: null as ((event: Event) => void) | null,
    onsuccess: null as ((event: Event) => void) | null
  };
  setTimeout(() => {
    request.result = result();
    request.onsuccess?.({ target: request } as unknown as Event);
    complete();
  }, 0);
  return request as unknown as IDBRequest<T>;
};

const installIndexedDb = (): void => {
  const entries = new Map<IDBValidKey, unknown>();
  const db = {
    close: jest.fn(),
    objectStoreNames: { contains: () => true },
    transaction: () => {
      const transaction = {
        abort: jest.fn(),
        error: null,
        onabort: null as ((event: Event) => void) | null,
        oncomplete: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        objectStore: () => store
      };
      const complete = (): void => transaction.oncomplete?.(new Event('complete'));
      const store = {
        delete: (key: IDBValidKey) =>
          makeRequest(() => {
            entries.delete(key);
          }, complete),
        get: (key: IDBValidKey) => makeRequest(() => entries.get(key), complete),
        getAll: () => makeRequest(() => [...entries.values()], complete),
        put: (value: unknown, key: IDBValidKey) =>
          makeRequest(() => {
            entries.set(key, value);
            return key;
          }, complete)
      } as unknown as IDBObjectStore;
      return transaction;
    }
  } as unknown as IDBDatabase;

  class TestOpenRequest {
    public readonly error = null;
    public readonly result = db;
    public onerror: ((event: Event) => void) | null = null;
    public onsuccess: ((event: Event) => void) | null = null;
    public onupgradeneeded: ((event: Event) => void) | null = null;

    constructor() {
      queueMicrotask(() => this.onsuccess?.({ target: this } as unknown as Event));
    }
  }

  Object.defineProperties(globalThis, {
    IDBOpenDBRequest: { configurable: true, value: TestOpenRequest },
    indexedDB: {
      configurable: true,
      value: { open: () => new TestOpenRequest() as unknown as IDBOpenDBRequest }
    }
  });
};

describe('IndexedDBStorageService', () => {
  beforeEach(() => {
    setFs(createFsFromVolume(new Volume()) as unknown as typeof fs);
    installIndexedDb();
    jest.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
      get: () => undefined
    } as unknown as vscode.WorkspaceConfiguration);
  });

  afterEach(() => {
    resetFs();
  });

  it('round trips arbitrary binary file contents', async () => {
    const path = '/binary/data.bin';
    const bytes = Buffer.from([0, 255, 128, 1, 13, 10, 42, 0, 254]);
    fs.mkdirSync('/binary', { recursive: true });
    fs.writeFileSync(path, bytes);

    const restored = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const storage = yield* IndexedDBStorageService;
          yield* storage.saveFile(path);
          fs.unlinkSync(path);
          yield* storage.loadFile(path);
          return fs.readFileSync(path);
        }).pipe(Effect.provide(IndexedDBStorageService.Default))
      )
    );

    expect([...restored]).toEqual([...bytes]);
  });
});
