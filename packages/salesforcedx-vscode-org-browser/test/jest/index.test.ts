/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Create a mutable tree view mock object
const createMockTreeView = (): vscode.TreeView<unknown> => {
  const treeView = {
    onDidChangeVisibility: jest.fn(() => ({ dispose: jest.fn() })),
    visible: true,
    message: undefined as string | undefined,
    description: undefined as string | undefined,
    dispose: jest.fn()
  };
  return treeView as unknown as vscode.TreeView<unknown>;
};

// Mock vscode module (must be first)
jest.mock('vscode', () => ({
  window: {
    registerTreeDataProvider: jest.fn(),
    createTreeView: jest.fn(() => createMockTreeView()),
    showInputBox: jest.fn()
  },
  commands: {
    registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
    executeCommand: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn()
    }))
  },
  extensions: {
    getExtension: jest.fn()
  },
  ExtensionContext: jest.fn(),
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  },
  TreeItem: class {},
  EventEmitter: class {
    public event = jest.fn();
    public fire = jest.fn();
    public dispose = jest.fn();
  },
  env: {
    createTelemetryLogger: jest.fn(() => ({
      logUsage: jest.fn(),
      logError: jest.fn(),
      dispose: jest.fn(),
      onDidChangeEnableStates: jest.fn()
    }))
  }
}));

import * as vscode from 'vscode';
import { Effect, Layer } from 'effect';
import { activateEffect, deactivateEffect } from '../../src/index';
import { ExtensionProviderService } from '../../src/services/extensionProvider';
import { FilePresenceService } from '../../src/services/filePresenceService';
import { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';

// 1. Full OutputChannel mock
const mockAppendLine = jest.fn();
const mockOutputChannel: vscode.OutputChannel = {
  name: 'mock',
  append: jest.fn(),
  appendLine: mockAppendLine,
  replace: jest.fn(),
  clear: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  dispose: jest.fn()
};

// 2. ChannelService mock - use the actual ChannelService tag
const mockChannelService = {
  getChannel: Effect.sync(() => mockOutputChannel),
  appendToChannel: (message: string): Effect.Effect<void> => Effect.sync(() => mockAppendLine(message))
};
const MockChannelServiceLayer = (_: string): Layer.Layer<ChannelService> =>
  Layer.effect(
    ChannelService,
    Effect.sync(() => mockChannelService as unknown as ChannelService)
  );

// Helper to create mock service with Default property
const createMockServiceWithDefault = (): { Default: Layer.Layer<never> } => ({
  Default: Layer.empty
});

// Mock vscode.extensions.getExtension to return a mock extension
const mockServicesApi: SalesforceVSCodeServicesApi = {
  services: {
    ConnectionService: createMockServiceWithDefault() as unknown as SalesforceVSCodeServicesApi['services']['ConnectionService'],
    ProjectService: createMockServiceWithDefault() as unknown as SalesforceVSCodeServicesApi['services']['ProjectService'],
    ChannelService,
    ChannelServiceLayer: MockChannelServiceLayer,
    WorkspaceService: createMockServiceWithDefault() as unknown as SalesforceVSCodeServicesApi['services']['WorkspaceService'],
    FsService: createMockServiceWithDefault() as unknown as SalesforceVSCodeServicesApi['services']['FsService'],
    ConfigService: createMockServiceWithDefault() as unknown as SalesforceVSCodeServicesApi['services']['ConfigService'],
    MetadataRetrieveService: createMockServiceWithDefault() as unknown as SalesforceVSCodeServicesApi['services']['MetadataRetrieveService'],
    MetadataRegistryService: createMockServiceWithDefault() as unknown as SalesforceVSCodeServicesApi['services']['MetadataRegistryService'],
    MetadataDescribeService: createMockServiceWithDefault() as unknown as SalesforceVSCodeServicesApi['services']['MetadataDescribeService'],
    SettingsService: createMockServiceWithDefault() as unknown as SalesforceVSCodeServicesApi['services']['SettingsService'],
    SourceTrackingService: createMockServiceWithDefault() as unknown as SalesforceVSCodeServicesApi['services']['SourceTrackingService'],
    SdkLayer: Layer.empty as unknown as SalesforceVSCodeServicesApi['services']['SdkLayer'],
    TargetOrgRef: {
      changes: Effect.never
    } as unknown as SalesforceVSCodeServicesApi['services']['TargetOrgRef']
  } as unknown as SalesforceVSCodeServicesApi['services']
};

// 3. ExtensionProviderService mock
const MockExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi: Effect.sync(() => mockServicesApi)
  }))
);

// 4. FilePresenceService mock
const MockFilePresenceServiceLive = Layer.sync(FilePresenceService, () => ({
  check: (): Effect.Effect<void> => Effect.void,
  start: (): { dispose: jest.Mock } => ({ dispose: jest.fn() }),
  startBatch: (): Promise<void> => Promise.resolve(),
  cancelBatch: (): void => {},
  cancelAllBatches: (): void => {},
  hasPendingBatches: (): boolean => false,
  setProgressCallback: (): void => {},
  setBatchCompleteCallback: (): void => {}
}));

const mockContext = {
  subscriptions: [],
  workspaceState: {
    get: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    keys: jest.fn().mockReturnValue([])
  }
} as unknown as vscode.ExtensionContext;

// Combined mock layer for all services - include ChannelService layer
const MockServicesLayer = Layer.mergeAll(
  MockExtensionProviderServiceLive,
  MockFilePresenceServiceLive,
  MockChannelServiceLayer('test')
);

describe('Extension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock vscode.extensions.getExtension to return our mock API
    (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
      isActive: true,
      exports: mockServicesApi
    });
    // Ensure createTreeView returns a mutable object
    (vscode.window.createTreeView as jest.Mock).mockReturnValue(createMockTreeView());
  });

  it('should activate successfully', async () => {
    await Effect.runPromise(
      Effect.provide(activateEffect(mockContext), MockServicesLayer) as Effect.Effect<void, Error, never>
    );
    expect(mockAppendLine).toHaveBeenCalledWith('Salesforce Org Browser activation complete.');
  });

  it('should deactivate successfully', async () => {
    await Effect.runPromise(
      Effect.provide(deactivateEffect, MockServicesLayer) as Effect.Effect<void | undefined, Error, never>
    );
    expect(mockAppendLine).toHaveBeenCalledWith('Salesforce Org Browser extension is now deactivated!');
  });
});
