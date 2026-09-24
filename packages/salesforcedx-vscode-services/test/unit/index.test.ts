/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock os module before any other imports
vi.mock('node:os', async () => ({
  ...(await vi.importActual<typeof import('node:os')>('node:os')),
  homedir: vi.fn(() => '/tmp')
}));

// Mock @salesforce/core
vi.mock('@salesforce/core', async () => ({
  ...(await vi.importActual<typeof import('@salesforce/core')>('@salesforce/core')),
  Global: {
    SF_DIR: '/tmp/sf',
    DIR: '/tmp/sf',
    SF_STATE_FOLDER: '.sf',
    isWeb: false,
    getEnvironmentMode: vi.fn(() => 'production')
  }
}));

vi.mock('@salesforce/core/fs', async () => {
  const actual = await vi.importActual<typeof import('@salesforce/core/fs')>('@salesforce/core/fs');
  return {
    ...actual,
    fs: {
      ...actual.fs,
      promises: {
        ...actual.fs.promises,
        watch: vi.fn(() => {
          throw Object.assign(new Error('file watching disabled in unit tests'), { code: 'EACCES' });
        })
      }
    }
  };
});

import { activate, deactivate } from '../../src/index';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { isServicesRuntimeReady } from '../../src/servicesRuntime';
import { getExtensionScope } from '../../src/vscode/extensionScope';
import { ConfigService } from '../../src/core/configService';
import { ConnectionService } from '../../src/core/connectionService';

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
  const originalModule = await vi.importActual<typeof import('../../src/virtualFsProvider/indexedDbStorage')>(
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
  ...(await vi.importActual<typeof import('node:fs')>('node:fs')),
  watch: vi.fn(() => ({
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
    // Mock the updateWorkspaceFolders method that's called in the index.ts
    vscode.workspace.updateWorkspaceFolders = vi.fn();
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
    } as unknown as import('vscode').ExtensionContext;

    const api = await activate(context);
    expect(api).toBeDefined();
    expect(api.services).toBeDefined();
    expect(api.services.ConnectionService).toBeDefined();
    expect(api.services.ProjectService).toBeDefined();
    const services = api.services.prebuiltServicesDependencies;
    Context.get(services, ConfigService);
    Context.get(services, ConnectionService);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    Effect.runSync(
      Effect.logInfo('api layer 00D000000000000!api-layer-secret').pipe(
        Effect.provide(api.services.prebuiltServicesLayer)
      )
    );
    expect(String(consoleLog.mock.calls[0][0])).toContain('<REDACTED ACCESS TOKEN>');
    expect(String(consoleLog.mock.calls[0][0])).not.toContain('api-layer-secret');
    consoleLog.mockRestore();
    const externalSdkContext = await Effect.runPromise(
      Layer.buildWithScope(api.services.SdkLayerFor(context), Effect.runSync(getExtensionScope()))
    );
    expect(externalSdkContext).toBeDefined();
  });

  it('should deactivate successfully', async () => {
    await deactivate();
    expect(true).toBe(true);
  });

  it('cleans up the runtime and extension scope when activation fails after acquisition', async () => {
    await deactivate();
    const acquiredScope = Effect.runSync(getExtensionScope());
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
    } as unknown as import('vscode').ExtensionContext;

    await expect(activate(context)).rejects.toThrow('activation failed');

    expect(isServicesRuntimeReady()).toBe(false);
    expect(Effect.runSync(getExtensionScope())).not.toBe(acquiredScope);
    vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
    await expect(activate(context)).resolves.toBeDefined();
    expect(isServicesRuntimeReady()).toBe(true);
    await deactivate();
  });
});
