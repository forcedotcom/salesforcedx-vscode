/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs, resetFs, setFs } from '@salesforce/core/fs';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { createFsFromVolume, Volume } from 'memfs';
import { Buffer } from 'node:buffer';
import { setImmediate } from 'node:timers/promises';
import * as vscode from 'vscode';
import { IndexedDBStorageService, IndexedDBStorageServiceLayer } from '../../../src/virtualFsProvider/indexedDbStorage';

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

const installIndexedDb = (holdOpen = false) => {
  const requests: TestOpenRequest[] = [];
  const entries = new Map<IDBValidKey, unknown>();
  const db = {
    close: vi.fn(),
    objectStoreNames: { contains: () => true },
    transaction: () => {
      const transaction = {
        abort: vi.fn(),
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
      requests.push(this);
      if (!holdOpen) queueMicrotask(() => this.onsuccess?.({ target: this } as unknown as Event));
    }
  }

  const open = vi.fn(() => new TestOpenRequest());
  Object.defineProperties(globalThis, {
    IDBOpenDBRequest: { configurable: true, value: TestOpenRequest },
    indexedDB: {
      configurable: true,
      value: { open }
    }
  });
  return {
    db,
    open,
    completeOpen: () => requests.forEach(request => request.onsuccess?.({ target: request } as unknown as Event))
  };
};

describe('IndexedDBStorageService', () => {
  beforeEach(() => {
    setFs(createFsFromVolume(new Volume()) as unknown as typeof fs);
    installIndexedDb();
    vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
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
        }).pipe(Effect.provide(IndexedDBStorageServiceLayer))
      )
    );

    expect([...restored]).toEqual([...bytes]);
  });

  it('shares one database connection within the owner memo map and closes after the last owner', async () => {
    const { db, open } = installIndexedDb();
    const memoMap = Layer.makeMemoMapUnsafe();
    const first = ManagedRuntime.make(IndexedDBStorageServiceLayer, { memoMap });
    const second = ManagedRuntime.make(IndexedDBStorageServiceLayer, { memoMap });
    try {
      const a = await first.runPromise(IndexedDBStorageService);
      const b = await second.runPromise(IndexedDBStorageService);
      expect(a).toBe(b);
      expect(open).toHaveBeenCalledTimes(1);
      await first.dispose();
      expect(db.close).not.toHaveBeenCalled();
      await second.dispose();
      expect(db.close).toHaveBeenCalledTimes(1);
    } finally {
      await first.dispose();
      await second.dispose();
    }
  });

  it('joins an in-flight native open during startup cancellation, then closes the acquired connection', async () => {
    const { db, open, completeOpen } = installIndexedDb(true);
    const controller = new AbortController();
    let returned = false;
    const running = Effect.runPromiseExit(IndexedDBStorageService.pipe(Effect.provide(IndexedDBStorageServiceLayer)), {
      signal: controller.signal
    }).then(result => {
      returned = true;
      return result;
    });
    await setImmediate();
    expect(open).toHaveBeenCalledTimes(1);
    controller.abort();
    await setImmediate();
    expect(returned).toBe(false);
    completeOpen();
    const exit = await running;
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) expect(exit.cause.reasons.some(reason => reason._tag === 'Interrupt')).toBe(true);
    expect(db.close).toHaveBeenCalledTimes(1);
  });
});
