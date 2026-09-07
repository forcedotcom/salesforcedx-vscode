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
import { IndexedDBStorageService, parseMyDomain } from '../../../src/virtualFsProvider/indexedDbStorage';

const makeRequest = <T>(result: () => T): IDBRequest<T> => {
  const request = {
    error: null,
    result: undefined as T,
    onerror: null as ((event: Event) => void) | null,
    onsuccess: null as ((event: Event) => void) | null
  };
  queueMicrotask(() => {
    request.result = result();
    request.onsuccess?.({ target: request } as unknown as Event);
  });
  return request as unknown as IDBRequest<T>;
};

const installIndexedDb = (): void => {
  const entries = new Map<IDBValidKey, unknown>();
  const store = {
    delete: (key: IDBValidKey) =>
      makeRequest(() => {
        entries.delete(key);
      }),
    get: (key: IDBValidKey) => makeRequest(() => entries.get(key)),
    getAll: () => makeRequest(() => [...entries.values()]),
    put: (value: unknown, key: IDBValidKey) =>
      makeRequest(() => {
        entries.set(key, value);
        return key;
      })
  } as unknown as IDBObjectStore;
  const db = {
    close: jest.fn(),
    objectStoreNames: { contains: () => true },
    transaction: () => ({ objectStore: () => store })
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

describe('parseMyDomain', () => {
  it('extracts myDomain from production URL', () => {
    expect(parseMyDomain('https://acme.my.salesforce.com')).toBe('acme');
  });

  it('extracts myDomain from sandbox URL', () => {
    expect(parseMyDomain('https://acme--dev.sandbox.my.salesforce.com')).toBe('acme--dev.sandbox');
  });

  it('extracts myDomain from scratch org URL', () => {
    expect(parseMyDomain('https://mycorp.scratch.my.salesforce.com')).toBe('mycorp.scratch');
  });

  it('extracts myDomain from military URL', () => {
    expect(parseMyDomain('https://acme.my.salesforce.mil')).toBe('acme');
  });

  it('extracts myDomain from alternative domain URL', () => {
    expect(parseMyDomain('https://acme.my-salesforce.com')).toBe('acme');
  });

  it('extracts myDomain from China domain URL', () => {
    expect(parseMyDomain('https://acme.my.sfcrmproducts.cn')).toBe('acme');
  });

  it('extracts myDomain from URL with trailing path', () => {
    expect(parseMyDomain('https://acme.my.salesforce.com/')).toBe('acme');
  });

  it('extracts myDomain from URL with path', () => {
    expect(parseMyDomain('https://acme.my.salesforce.com/lightning/setup/SetupOneHome/home')).toBe('acme');
  });

  it('falls back to full hostname for unknown domain', () => {
    expect(parseMyDomain('https://unknown.example.com')).toBe('unknown.example.com');
  });

  it('falls back to full hostname for internal vpod domain', () => {
    expect(parseMyDomain('https://acme.vpod.force.com')).toBe('acme.vpod.force.com');
  });
});

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
