/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock os module before any other imports
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: jest.fn(() => '/tmp')
}));

// Mock @salesforce/core
jest.mock('@salesforce/core', () => ({
  ...jest.requireActual('@salesforce/core'),
  Global: {
    SF_DIR: '/tmp/sf',
    DIR: '/tmp/sf',
    SF_STATE_FOLDER: '.sf',
    isWeb: false,
    getEnvironmentMode: jest.fn(() => 'production')
  }
}));

import { activate, deactivate } from '../../src/index';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { projectFiles } from '../../src/virtualFsProvider/projectInit';
import { SettingsService } from '../../src/vscode/settingsService';
import { WorkspaceService } from '../../src/vscode/workspaceService';
import { isServicesRuntimeReady } from '../../src/servicesRuntime';
import { getExtensionScope } from '../../src/vscode/extensionScope';
import { ConfigService } from '../../src/core/configService';
import { ConnectionService } from '../../src/core/connectionService';
import { getDefaultOrgRef } from '../../src/core/defaultOrgRef';
import * as SubscriptionRef from 'effect/SubscriptionRef';

// Mock indexedDB API for Node.js environment
const mockIndexedDB: Partial<IDBFactory> = {
  open: jest.fn().mockReturnValue({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      transaction: jest.fn().mockReturnValue({
        objectStore: jest.fn().mockReturnValue({
          put: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          }),
          get: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          }),
          getAll: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          }),
          delete: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          })
        }),
        oncomplete: null,
        onerror: null
      }),
      createObjectStore: jest.fn(),
      objectStoreNames: {
        contains: jest.fn().mockReturnValue(false)
      },
      close: jest.fn()
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
g.IDBOpenDBRequest = jest.fn() as unknown as typeof IDBOpenDBRequest;

// Mock spansNode to avoid path.join issues
jest.mock('../../src/observability/spansNode', () => {
  const E = require('effect');
  return {
    NodeSdkLayerFor: () => E.Layer.empty
  };
});

// Mock IndexedDB Storage Service
jest.mock('../../src/virtualFsProvider/indexedDbStorage', () => {
  const originalModule = jest.requireActual('../../src/virtualFsProvider/indexedDbStorage');
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
jest.mock('../../src/virtualFsProvider/fileSystemProvider', () => ({
  FsProvider: class MockFsProvider {
    public readonly onDidChangeFile = { event: jest.fn() };

    public exists = jest.fn().mockReturnValue(false);
    public createDirectory = jest.fn();
    public writeFile = jest.fn();
    public readFile = jest.fn();
    public delete = jest.fn();
    public rename = jest.fn();
    public stat = jest.fn();
    public readDirectory = jest.fn().mockReturnValue([]);
    public watch = jest.fn();
  }
}));

// Mock memfsWatcher to avoid file watching in tests
jest.mock('../../src/virtualFsProvider/memfsWatcher', () => ({
  startWatch: () => {
    const E = require('effect');
    return E.Effect.succeed(undefined);
  },
  emitter: {
    event: jest.fn(),
    fire: jest.fn()
  }
}));

// Mock FileWatcherLayer to avoid vscode.workspace.createFileSystemWatcher
jest.mock('../../src/vscode/fileWatcherService', () => {
  const E = require('effect');
  return {
    FileWatcherLayer: E.Layer.empty
  };
});

// Mock SettingsWatcherLayer to avoid vscode.workspace.onDidChangeConfiguration
jest.mock('../../src/vscode/settingsWatcherService', () => {
  const E = require('effect');
  return {
    SettingsWatcherLayer: E.Layer.empty
  };
});

// Mock node:os module
jest.mock('node:os', () => ({
  homedir: jest.fn(() => '/tmp'),
  platform: jest.fn(() => 'linux'),
  arch: jest.fn(() => 'x64'),
  tmpdir: jest.fn(() => '/tmp'),
  hostname: jest.fn(() => 'mock-hostname'),
  type: jest.fn(() => 'Linux'),
  release: jest.fn(() => '5.4.0'),
  totalmem: jest.fn(() => 8_589_934_592),
  freemem: jest.fn(() => 4_294_967_296),
  cpus: jest.fn(() => []),
  networkInterfaces: jest.fn(() => ({})),
  userInfo: jest.fn(() => ({ username: 'testuser', uid: 1000, gid: 1000, shell: '/bin/bash', homedir: '/tmp' })),
  uptime: jest.fn(() => 123_456),
  loadavg: jest.fn(() => [0.5, 0.3, 0.2]),
  EOL: '\n',
  constants: {
    signals: {},
    errno: {},
    priority: {}
  }
}));

// Mock node:fs module.
// jest 30 resolves 'node:fs' and 'fs' to the same module registry entry, so this factory
// also serves unrelated consumers that require('fs') (e.g. got). Spread the real module so
// only the members below are replaced.
jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  watch: jest.fn(() => ({
    close: jest.fn()
  })),
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
    rmdir: jest.fn()
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
    const vscode = require('vscode');
    vscode.extensions = {
      getExtension: jest.fn().mockReturnValue({ extensionUri: mockExtensionUri }),
      all: [],
      onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() })
    };
    vscode.workspace.workspaceFolders = [
      {
        uri: {
          scheme: 'file',
          fsPath: '/mock/workspace',
          toString: (): string => 'file:///mock/workspace'
        },
        name: 'mock-workspace',
        index: 0
      }
    ];
    // Mock the updateWorkspaceFolders method that's called in the index.ts
    vscode.workspace.updateWorkspaceFolders = jest.fn();
  });

  it('activates with one default-org ref shared by policy, snapshot, and span SDKs', async () => {
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
        get: jest.fn().mockReturnValue(undefined),
        update: jest.fn().mockResolvedValue(undefined)
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
    const externalSdkContext = await Effect.runPromise(
      Layer.buildWithScope(api.services.SdkLayerFor(context), Effect.runSync(getExtensionScope()))
    );
    expect(externalSdkContext).toBeDefined();

    const defaultOrgRef = await Effect.runPromise(getDefaultOrgRef());
    await Effect.runPromise(SubscriptionRef.set(defaultOrgRef, { orgId: 'gov-org', instanceName: 'usa9s' }));
    expect(api.services.TelemetryIdentitySnapshot()).toMatchObject({
      orgId: 'gov-org',
      telemetryClassification: 'gov'
    });
    expect(api.services.TelemetryIdentitySnapshot()).not.toHaveProperty('instanceName');

    await Effect.runPromise(SubscriptionRef.set(defaultOrgRef, { orgId: 'non-gov-org', instanceName: 'na123' }));
    expect(api.services.TelemetryIdentitySnapshot().telemetryClassification).toBe('nonGov');
  });

  it('should deactivate successfully', async () => {
    await deactivate();
    expect(true).toBe(true);
  });

  it('cleans up the runtime and extension scope when activation fails after acquisition', async () => {
    await deactivate();
    const vscode = require('vscode');
    const acquiredScope = Effect.runSync(getExtensionScope());
    vscode.commands.executeCommand = jest.fn().mockRejectedValue(new Error('activation failed'));
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
        get: jest.fn().mockReturnValue(undefined),
        update: jest.fn().mockResolvedValue(undefined)
      }
    } as unknown as import('vscode').ExtensionContext;

    await expect(activate(context)).rejects.toThrow('activation failed');

    expect(isServicesRuntimeReady()).toBe(false);
    expect(Effect.runSync(getExtensionScope())).not.toBe(acquiredScope);
    vscode.commands.executeCommand.mockResolvedValue(undefined);
    await expect(activate(context)).resolves.toBeDefined();
    expect(isServicesRuntimeReady()).toBe(true);
    await deactivate();
  });

  it('should handle homedir correctly in web environment', async () => {
    // Mock the fsProvider with all required methods
    const mockFsProvider = {
      exists: jest.fn().mockReturnValue(false),
      createDirectory: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
      readFile: jest.fn(),
      delete: jest.fn(),
      rename: jest.fn(),
      stat: jest.fn(),
      readDirectory: jest.fn(),
      watch: jest.fn(),
      onDidChangeFile: jest.fn(),
      findFiles: jest.fn().mockResolvedValue([])
    };

    // Test that projectFiles works correctly with proper mocking
    // The function should succeed when dependencies are properly mocked
    await expect(
      projectFiles(mockFsProvider).pipe(
        Effect.provide(Layer.mergeAll(SettingsService.Default, WorkspaceService.Default)),
        Effect.runPromise
      )
    ).resolves.toBeUndefined();
  });
});
