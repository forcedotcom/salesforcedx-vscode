/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type * as NodeFsModule from 'node:fs';
import type * as NodeOsModule from 'node:os';
import type * as SalesforceCoreModule from '@salesforce/core';
import type * as SalesforceCoreFsModule from '@salesforce/core/fs';
import type * as IndexedDbStorageModule from '../../src/virtualFsProvider/indexedDbStorage';

// Mock os module before any other imports
vi.mock('node:os', async () => ({
  ...(await vi.importActual<typeof NodeOsModule>('node:os')),
  homedir: vi.fn(() => '/tmp')
}));

// Mock @salesforce/core
vi.mock('@salesforce/core', async () => ({
  ...(await vi.importActual<typeof SalesforceCoreModule>('@salesforce/core')),
  Global: {
    SF_DIR: '/tmp/sf',
    DIR: '/tmp/sf',
    SF_STATE_FOLDER: '.sf',
    isWeb: false,
    getEnvironmentMode: vi.fn(() => 'production')
  }
}));

vi.mock('@salesforce/core/fs', async () => {
  const actual = await vi.importActual<typeof SalesforceCoreFsModule>('@salesforce/core/fs');
  const mockedFs = {
    ...actual.fs,
    promises: {
      ...actual.fs.promises,
      watch: vi.fn(() => {
        throw Object.assign(new Error('file watching disabled in unit tests'), { code: 'EACCES' });
      })
    }
  };
  const mockedModule = { ...actual, fs: mockedFs };
  return {
    ...mockedModule,
    default: mockedModule
  };
});

import { activate, deactivate } from '../../src/index';
import { type ExtensionContext } from 'vscode';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as vscode from 'vscode';
import { isServicesRuntimeReady } from '../../src/servicesRuntime';
import { ConnectionService, publicServiceKeys } from '@salesforce/vscode-services/v2';

// Mock indexedDB API for Node.js environment
const mockIndexedDB: Partial<IDBFactory> = {
  open: vi.fn().mockReturnValue({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      transaction: vi.fn().mockReturnValue({
        objectStore: vi.fn().mockReturnValue({
          put: vi.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          }),
          get: vi.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          }),
          getAll: vi.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          }),
          delete: vi.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          })
        }),
        oncomplete: null,
        onerror: null
      }),
      createObjectStore: vi.fn(),
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(false)
      },
      close: vi.fn()
    }
  })
};

// Mock the global indexedDB
type GlobalWithIDB = typeof globalThis & {
  indexedDB: unknown;
  IDBOpenDBRequest: unknown;
};
const g = globalThis as GlobalWithIDB;
g.indexedDB = mockIndexedDB as unknown as IDBFactory;
g.IDBOpenDBRequest = vi.fn() as unknown as typeof IDBOpenDBRequest;

// Mock spansNode to avoid path.join issues
vi.mock('../../src/observability/spansNode', () => {
  const E = require('effect');
  return {
    NodeSdkLayerFor: () => E.Layer.empty
  };
});

// Mock IndexedDB Storage Service
vi.mock('../../src/virtualFsProvider/indexedDbStorage', async () => {
  const originalModule = await vi.importActual<typeof IndexedDbStorageModule>(
    '../../src/virtualFsProvider/indexedDbStorage'
  );
  const E = require('effect');

  const mockStorage = {
    loadState: () => E.Effect.succeed(undefined),
    saveFile: () => E.Effect.succeed(undefined),
    deleteFile: () => E.Effect.void,
    loadFile: () => E.Effect.void
  };

  return {
    ...originalModule,
    IndexedDBStorageServiceShared: E.Layer.succeed(originalModule.IndexedDBStorageService, mockStorage)
  };
});

// Mock FsProvider to avoid IndexedDB initialization
vi.mock('../../src/virtualFsProvider/fileSystemProvider', () => ({
  FsProvider: class MockFsProvider {
    public readonly onDidChangeFile = { event: vi.fn() };

    public exists = vi.fn().mockReturnValue(false);
    public createDirectory = vi.fn();
    public writeFile = vi.fn();
    public readFile = vi.fn();
    public delete = vi.fn();
    public rename = vi.fn();
    public stat = vi.fn();
    public readDirectory = vi.fn().mockReturnValue([]);
    public watch = vi.fn();
  }
}));

// Mock memfsWatcher to avoid file watching in tests
vi.mock('../../src/virtualFsProvider/memfsWatcher', () => ({
  startWatch: () => {
    const E = require('effect');
    return E.Effect.succeed(undefined);
  },
  emitter: {
    event: vi.fn(),
    fire: vi.fn()
  }
}));

// Mock FileWatcherLayer to avoid vscode.workspace.createFileSystemWatcher
vi.mock('../../src/vscode/fileWatcherService', () => {
  const E = require('effect');
  return {
    FileWatcherLayer: E.Layer.empty
  };
});

// Mock SettingsWatcherLayer to avoid vscode.workspace.onDidChangeConfiguration
vi.mock('../../src/vscode/settingsWatcherService', () => {
  const E = require('effect');
  return {
    SettingsWatcherLayer: E.Layer.empty
  };
});

// Mock node:os module
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/tmp'),
  platform: vi.fn(() => 'linux'),
  arch: vi.fn(() => 'x64'),
  tmpdir: vi.fn(() => '/tmp'),
  hostname: vi.fn(() => 'mock-hostname'),
  type: vi.fn(() => 'Linux'),
  release: vi.fn(() => '5.4.0'),
  totalmem: vi.fn(() => 8_589_934_592),
  freemem: vi.fn(() => 4_294_967_296),
  cpus: vi.fn(() => []),
  networkInterfaces: vi.fn(() => ({})),
  userInfo: vi.fn(() => ({ username: 'testuser', uid: 1000, gid: 1000, shell: '/bin/bash', homedir: '/tmp' })),
  uptime: vi.fn(() => 123_456),
  loadavg: vi.fn(() => [0.5, 0.3, 0.2]),
  EOL: '\n',
  constants: {
    signals: {},
    errno: {},
    priority: {}
  }
}));

// Mock node:fs module.
// Vitest resolves 'node:fs' and 'fs' to the same module registry entry, so this factory
// also serves unrelated consumers that require('fs') (e.g. got). Spread the real module so
// only the members below are replaced.
vi.mock('node:fs', async () => ({
  ...(await vi.importActual<typeof NodeFsModule>('node:fs')),
  watch: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn()
  })),
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn()
  },
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1
  }
}));

const { URI } = require('vscode-uri');

const mockExtensionUri = URI.file('/mock/extension');

describe('Extension', () => {
  beforeEach(() => {
    // Mock workspace.workspaceFolders to have at least one folder
    Object.assign(vscode.extensions, {
      getExtension: vi.fn().mockReturnValue({ extensionUri: mockExtensionUri }),
      all: [],
      onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() })
    });
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      configurable: true,
      value: [
        {
          uri: {
            scheme: 'file',
            fsPath: '/mock/workspace',
            toString: (): string => 'file:///mock/workspace'
          },
          name: 'mock-workspace',
          index: 0
        }
      ]
    });
    vscode.workspace.createFileSystemWatcher = vi.fn(() => ({
      onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
      onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
      onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
      dispose: vi.fn()
    })) as unknown as typeof vscode.workspace.createFileSystemWatcher;
    Object.defineProperty(vscode.workspace, 'onDidChangeConfiguration', {
      configurable: true,
      value: vi.fn(() => ({ dispose: vi.fn() }))
    });
    Object.defineProperty(vscode.window, 'onDidChangeActiveTextEditor', {
      configurable: true,
      value: vi.fn(() => ({ dispose: vi.fn() }))
    });
    vscode.workspace.registerTextDocumentContentProvider = vi.fn(() => ({
      dispose: vi.fn()
    })) as unknown as typeof vscode.workspace.registerTextDocumentContentProvider;
    vscode.languages.createDiagnosticCollection = vi.fn(() => ({
      set: vi.fn(),
      get: vi.fn(),
      has: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      forEach: vi.fn(),
      dispose: vi.fn()
    })) as unknown as typeof vscode.languages.createDiagnosticCollection;
    Object.defineProperty(vscode.window, 'activeTextEditor', { configurable: true, value: undefined });
    vscode.commands.registerCommand = vi.fn(() => ({
      dispose: vi.fn()
    })) as unknown as typeof vscode.commands.registerCommand;
    // Mock the updateWorkspaceFolders method that's called in the index.ts
    vscode.workspace.updateWorkspaceFolders = vi.fn();
    // resetMocks clears the vscode stub, and ChannelDisposalLayer calls dispose() on every cached channel.
    vscode.window.createOutputChannel = vi.fn(() => ({
      name: 'test',
      append: vi.fn(),
      clear: vi.fn(),
      appendLine: vi.fn(),
      replace: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn()
    })) as unknown as typeof vscode.window.createOutputChannel;
  });

  it('activates with shared services and an external span SDK', async () => {
    const context = {
      subscriptions: [],
      extension: {
        packageJSON: {
          name: 'test-extension',
          version: '1.0.0',
          aiKey: 'test-key',
          o11yUploadEndpoint: 'test-endpoint',
          enableO11y: 'false'
        }
      },
      globalState: {
        get: vi.fn().mockReturnValue(undefined),
        update: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ExtensionContext;

    const api = await activate(context);
    expect(api).toBeDefined();
    expect(api.services).toBeDefined();
    expect(api.services.ConnectionService).toBeDefined();
    expect(api.v2.services.ProjectService).toBeDefined();
    const services = api.v2.services.prebuiltServicesDependencies;
    Context.get(services, ConnectionService);
    expect([...services.mapUnsafe.keys()].toSorted()).toEqual(
      Object.values(publicServiceKeys)
        .map(key => key.key)
        .toSorted()
    );
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    Effect.runSync(
      Effect.logInfo('api layer 00D000000000000!api-layer-secret').pipe(
        Effect.provide(api.v2.services.prebuiltServicesLayer)
      )
    );
    expect(String(consoleLog.mock.calls[0][0])).toContain('<REDACTED ACCESS TOKEN>');
    expect(String(consoleLog.mock.calls[0][0])).not.toContain('api-layer-secret');
    consoleLog.mockRestore();
    const sdk = ManagedRuntime.make(
      api.v2.services.SdkLayerFor(context).pipe(Layer.provide(api.v2.services.prebuiltServicesLayer))
    );
    await sdk.runPromise(Effect.void);
    await sdk.dispose();
  });

  it('should deactivate successfully', async () => {
    await deactivate();
    expect(true).toBe(true);
  });

  it('cleans up the V4 owner and allows activation to retry after startup fails', async () => {
    await deactivate();
    vi.mocked(vscode.commands.executeCommand).mockRejectedValue(new Error('activation failed'));
    const context = {
      subscriptions: [],
      extension: {
        packageJSON: {
          name: 'test-extension',
          version: '1.0.0',
          enableO11y: 'false'
        }
      },
      globalState: {
        get: vi.fn().mockReturnValue(undefined),
        update: vi.fn().mockResolvedValue(undefined)
      }
    } as unknown as ExtensionContext;

    const activationFailure = await activate(context).then(
      () => undefined,
      (error: unknown) => error
    );
    expect(activationFailure).toBeDefined();
    expect(
      activationFailure instanceof AggregateError
        ? activationFailure.errors.map(String).join('\n')
        : String(activationFailure)
    ).toContain('activation failed');

    expect(isServicesRuntimeReady()).toBe(false);
    vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
    await expect(activate(context)).resolves.toBeDefined();
    expect(isServicesRuntimeReady()).toBe(true);
    await deactivate();
  });
});
