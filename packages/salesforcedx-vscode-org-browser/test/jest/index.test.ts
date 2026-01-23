/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock vscode module (must be first)
jest.mock('vscode', () => ({
  window: {
    registerTreeDataProvider: jest.fn()
  },
  commands: {
    registerCommand: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn()
    }))
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
import {
  ExtensionProviderService,
  type ExtensionProviderService as ExtensionProviderServiceType
} from '../../src/services/extensionProvider';
import { ComponentSetService } from 'salesforcedx-vscode-services/src/core/componentSetService';
import { ConnectionService } from 'salesforcedx-vscode-services/src/core/connectionService';
import { ProjectService } from 'salesforcedx-vscode-services/src/core/projectService';
import { MetadataDeleteService } from 'salesforcedx-vscode-services/src/core/metadataDeleteService';
import { MetadataDeployService } from 'salesforcedx-vscode-services/src/core/metadataDeployService';
import { MetadataDescribeService } from 'salesforcedx-vscode-services/src/core/metadataDescribeService';
import { MetadataRegistryService } from 'salesforcedx-vscode-services/src/core/metadataRegistryService';
import { MetadataRetrieveService } from 'salesforcedx-vscode-services/src/core/metadataRetrieveService';
import { SourceTrackingService } from 'salesforcedx-vscode-services/src/core/sourceTrackingService';
import { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { ConfigService } from 'salesforcedx-vscode-services/src/core/configService';
import { SettingsService, SettingsError } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import { EditorService } from 'salesforcedx-vscode-services/src/vscode/editorService';
import { FileWatcherService } from 'salesforcedx-vscode-services/src/vscode/fileWatcherService';
import { getDefaultOrgRef } from 'salesforcedx-vscode-services/src/core/defaultOrgRef';
import { SdkLayerFor } from 'salesforcedx-vscode-services/src/observability/spans';
import { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import type { Connection } from '@salesforce/core';
import type { ConfigAggregator } from '@salesforce/core/configAggregator';
import { URI } from 'vscode-uri';

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

// 2. ChannelService mock
const MockChannelServiceLayer = (_: string): Layer.Layer<ChannelService> =>
  Layer.succeed(
    ChannelService,
    new ChannelService({
      getChannel: Effect.sync(() => mockOutputChannel),
      appendToChannel: (message: string) => Effect.sync(() => mockAppendLine(message))
    })
  );

// 3. Mock WorkspaceService layer (needed by ConfigService)
const mockWorkspaceUri = URI.parse('file:///mock/workspace');
const mockWorkspaceInfo = {
  uri: mockWorkspaceUri,
  path: '/mock/workspace',
  fsPath: '/mock/workspace',
  isEmpty: false as const,
  isVirtualFs: false,
  cwd: '/mock/workspace'
};
const MockWorkspaceServiceLayer = Layer.succeed(
  WorkspaceService,
  new WorkspaceService({
    getWorkspaceInfo: Effect.sync(() => mockWorkspaceInfo),
    getWorkspaceInfoOrThrow: Effect.sync(() => mockWorkspaceInfo)
  } as const)
);

// 4. Mock ConfigService layer (needed by ConnectionService)
const mockConfigAggregator: ConfigAggregator = {
  getPropertyValue: <T>(_key: string): T | undefined => undefined
} as ConfigAggregator;
const MockConfigServiceLayer = Layer.succeed(
  ConfigService,
  new ConfigService({
    getConfigAggregator: Effect.sync(() => mockConfigAggregator)
  } as const)
);

// 5. Mock SettingsService layer (needed by ConnectionService.getConnection)
const MockSettingsServiceLayer = Layer.succeed(
  SettingsService,
  new SettingsService({
    getValue: <T>(_section: string, _key: string, defaultValue?: T) =>
      Effect.try({
        try: () => defaultValue ?? undefined,
        catch: () => new SettingsError({ cause: new Error('Mock error'), section: _section, key: _key })
      }),
    setValue: <T>(_section: string, _key: string, _value: T) =>
      Effect.tryPromise({
        try: async () => undefined,
        catch: () => new SettingsError({ cause: new Error('Mock error'), section: _section, key: _key })
      }),
    getInstanceUrl: Effect.succeed('https://test.salesforce.com'),
    getAccessToken: Effect.succeed('mock-token'),
    getApiVersion: Effect.succeed('60.0'),
    setInstanceUrl: (_url: string) =>
      Effect.tryPromise({
        try: async () => undefined,
        catch: () => new SettingsError({ cause: new Error('Mock error'), section: '', key: '' })
      }),
    setAccessToken: (_token: string) =>
      Effect.tryPromise({
        try: async () => undefined,
        catch: () => new SettingsError({ cause: new Error('Mock error'), section: '', key: '' })
      }),
    setApiVersion: (_version: string) =>
      Effect.tryPromise({
        try: async () => undefined,
        catch: () => new SettingsError({ cause: new Error('Mock error'), section: '', key: '' })
      }),
    getRetrieveOnLoad: Effect.succeed('')
  } as const)
);

// 6. Mock ConnectionService layer (needed by activateEffect)
const mockConnection: Connection = {} as Connection;
const MockConnectionServiceLayer = Layer.succeed(
  ConnectionService,
  new ConnectionService({
    getConnection: Effect.sync(() => mockConnection)
  } as const)
);

// 7. ExtensionProviderService mock
const mockServicesApi = {
  services: {
    ChannelService,
    ChannelServiceLayer: MockChannelServiceLayer,
    ComponentSetService: {} as typeof ComponentSetService,
    ConfigService: {} as typeof ConfigService,
    ConnectionService: {} as typeof ConnectionService,
    EditorService: {} as typeof EditorService,
    FileWatcherService: {} as typeof FileWatcherService,
    FsService: {} as typeof FsService,
    MetadataDeleteService: {} as typeof MetadataDeleteService,
    MetadataDescribeService: {} as typeof MetadataDescribeService,
    MetadataDeployService: {} as typeof MetadataDeployService,
    MetadataRegistryService: {} as typeof MetadataRegistryService,
    MetadataRetrieveService: {} as typeof MetadataRetrieveService,
    ProjectService: {} as typeof ProjectService,
    SdkLayerFor: {} as typeof SdkLayerFor,
    SettingsService: {} as typeof SettingsService,
    SourceTrackingService: {} as typeof SourceTrackingService,
    TargetOrgRef: getDefaultOrgRef,
    WorkspaceService: {} as typeof WorkspaceService
  }
} as unknown as SalesforceVSCodeServicesApi;

const MockExtensionProviderServiceLive = Layer.succeed(ExtensionProviderService, {
  getServicesApi: Effect.succeed(mockServicesApi) as ExtensionProviderServiceType['getServicesApi']
});

const mockContext = {
  subscriptions: []
} as unknown as vscode.ExtensionContext;

describe.skip('Extension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should activate successfully', async () => {
    await Effect.runPromise(
      activateEffect(mockContext).pipe(
        Effect.provide(
          Layer.mergeAll(
            MockExtensionProviderServiceLive,
            MockChannelServiceLayer('test'),
            MockWorkspaceServiceLayer,
            MockConfigServiceLayer,
            MockSettingsServiceLayer,
            MockConnectionServiceLayer
          )
        )
      )
    );
    expect(mockAppendLine).toHaveBeenCalledWith('Salesforce Org Browser activation complete.');
  });

  it('should deactivate successfully', async () => {
    await Effect.runPromise(
      deactivateEffect().pipe(
        Effect.provide(Layer.mergeAll(MockExtensionProviderServiceLive, MockChannelServiceLayer('test')))
      )
    );
    expect(mockAppendLine).toHaveBeenCalledWith('Salesforce Org Browser extension is now deactivated!');
  });
});
