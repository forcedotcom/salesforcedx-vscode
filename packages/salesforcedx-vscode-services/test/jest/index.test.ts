/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { activate, deactivate } from '../../src/index';
import { ChannelService } from '../../src/vscode/channelService';
import { Layer, Effect as EffectFn } from 'effect';
import type { Effect } from 'effect/Effect';
import { projectFiles } from '../../src/virtualFsProvider/projectInit';

// Mock FsProvider to avoid IndexedDB initialization
jest.mock('../../src/virtualFsProvider/fileSystemProvider', () => ({
  FsProvider: class MockFsProvider {
    public readonly onDidChangeFile = { event: jest.fn() };

    public async init(): Promise<this> {
      return this;
    }

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

// Mock node:os module
jest.mock('node:os', () => ({
  homedir: jest.fn(() => '/tmp'),
  platform: jest.fn(() => 'linux'),
  arch: jest.fn(() => 'x64'),
  tmpdir: jest.fn(() => '/tmp'),
  hostname: jest.fn(() => 'mock-hostname'),
  type: jest.fn(() => 'Linux'),
  release: jest.fn(() => '5.4.0'),
  totalmem: jest.fn(() => 8589934592),
  freemem: jest.fn(() => 4294967296),
  cpus: jest.fn(() => []),
  networkInterfaces: jest.fn(() => ({})),
  userInfo: jest.fn(() => ({ username: 'testuser', uid: 1000, gid: 1000, shell: '/bin/bash', homedir: '/tmp' })),
  uptime: jest.fn(() => 123456),
  loadavg: jest.fn(() => [0.5, 0.3, 0.2]),
  EOL: '\n',
  constants: {
    signals: {},
    errno: {},
    priority: {}
  }
}));

// Mock node:fs module
jest.mock('node:fs', () => ({
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

// Create a mock ChannelService
const mockChannelService = {
  getChannel: EffectFn.sync(() => ({
    appendLine: jest.fn(),
    append: jest.fn(),
    clear: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
    name: 'mock',
    replace: jest.fn(),
    logLevel: 0,
    onDidChangeLogLevel: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })),
  appendToChannel: (_message: string): Effect<void, never, never> => EffectFn.sync(() => {})
};

const MockChannelServiceLayer = Layer.succeed(ChannelService, mockChannelService);

describe('Extension', () => {
  beforeEach(() => {
    // Mock workspace.workspaceFolders to have at least one folder
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vscode = require('vscode');
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

  it('should activate successfully', async () => {
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
        update: jest.fn()
      }
    } as unknown as import('vscode').ExtensionContext;

    // Provide the mock ChannelService layer for activation
    const api = await activate(context, MockChannelServiceLayer);
    expect(api).toBeDefined();
    expect(api.services).toBeDefined();
    expect(api.services.ConnectionService).toBeDefined();
    expect(api.services.ProjectService).toBeDefined();
  });

  it('should deactivate successfully', () => {
    deactivate();
    expect(true).toBe(true);
  });

  it('should handle homedir correctly in web environment', async () => {
    // Mock the fsProvider with all required methods
    const mockFsProvider = {
      exists: jest.fn().mockReturnValue(false),
      createDirectory: jest.fn(),
      writeFile: jest.fn(),
      readFile: jest.fn(),
      delete: jest.fn(),
      rename: jest.fn(),
      stat: jest.fn(),
      readDirectory: jest.fn(),
      watch: jest.fn(),
      onDidChangeFile: jest.fn()
    };

    // Test that projectFiles can be called without throwing an error
    // This verifies that the homedir fix works
    await expect(projectFiles(mockFsProvider)).resolves.toBeUndefined();
  });
});
