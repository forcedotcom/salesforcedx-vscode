/*
 * Copyright (c) 2026, salesforce.com, inc.
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
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
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

import {
  ExtensionProviderService,
  type ExtensionProviderService as ExtensionProviderServiceType
} from '@salesforce/effect-ext-utils';
import { NotificationModeService } from 'salesforcedx-vscode-services/src/vscode/notificationModeService';
import * as vscode from 'vscode';
import { Effect, Layer } from 'effect';
import * as Fiber from 'effect/Fiber';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { activateEffect, deactivateEffect } from '../../src/index';
import { ComponentSetService } from 'salesforcedx-vscode-services/src/core/componentSetService';
import { ConnectionService } from 'salesforcedx-vscode-services/src/core/connectionService';
import { ProjectService } from 'salesforcedx-vscode-services/src/core/projectService';
import { MetadataDeleteService } from 'salesforcedx-vscode-services/src/core/metadataDeleteService';
import { MetadataDeployService } from 'salesforcedx-vscode-services/src/core/metadataDeployService';
import { MetadataRegistryService } from 'salesforcedx-vscode-services/src/core/metadataRegistryService';
import { MetadataRetrieveService } from 'salesforcedx-vscode-services/src/core/metadataRetrieveService';
import { SourceTrackingService } from 'salesforcedx-vscode-services/src/core/sourceTrackingService';
import { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { ConfigService } from 'salesforcedx-vscode-services/src/core/configService';
import { SettingsService, SettingsError } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import { EditorService } from 'salesforcedx-vscode-services/src/vscode/editorService';
import { getDefaultOrgRef } from 'salesforcedx-vscode-services/src/core/defaultOrgRef';
import { SdkLayerFor } from 'salesforcedx-vscode-services/src/observability/spans';
import { OrgMetadataCatalogChangePubSub } from 'salesforcedx-vscode-services/src/orgCatalog/orgMetadataCatalogChangePubSub';
import { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import { ErrorHandlerService } from 'salesforcedx-vscode-services/src/vscode/errorHandlerService';
import { ExtensionContextService } from 'salesforcedx-vscode-services/src/vscode/extensionContextService';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import { createMockOutputChannel } from 'salesforcedx-vscode-services/test/jest/testUtils';
import { OrgBrowserRetrieveService } from '../../src/services/orgBrowserMetadataRetrieveService';
import type { Connection } from '@salesforce/core';
import type { ConfigAggregator } from '@salesforce/core/configAggregator';
import { URI } from 'vscode-uri';

// 1. Full OutputChannel mock
const mockAppendLine = jest.fn();
const mockOutputChannel = createMockOutputChannel();
// Override appendLine to use our tracked mock function
mockOutputChannel.appendLine = mockAppendLine;

// 2. ChannelService mock
const MockChannelServiceLayer = (_: string): Layer.Layer<ChannelService> =>
  Layer.succeed(
    ChannelService,
    new ChannelService({
      getChannel: Effect.sync(() => mockOutputChannel),
      showChannel: Effect.void,
      clearChannel: Effect.succeed(undefined),
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
    getWorkspaceInfo: () => Effect.sync(() => mockWorkspaceInfo),
    getWorkspaceInfoOrThrow: () => Effect.sync(() => mockWorkspaceInfo)
  } as const)
);

// 4. Mock ConfigService layer (needed by ConnectionService)
const mockConfigAggregator: ConfigAggregator = {
  getPropertyValue: <T>(_key: string): T | undefined => undefined
} as ConfigAggregator;
const MockConfigServiceLayer = Layer.succeed(
  ConfigService,
  new ConfigService({
    getConfigAggregator: () => Effect.sync(() => mockConfigAggregator),
    invalidateConfigAggregator: () => Effect.void,
    getTargetDevHub: () => Effect.succeed(undefined),
    getTargetOrg: () => Effect.succeed(undefined),
    isCliTelemetryDisabled: () => Effect.succeed(false),
    isCurrentTargetOrg: () => Effect.succeed(false),
    isCurrentTargetDevHub: () => Effect.succeed(false),
    unsetTargetOrg: () => Effect.void,
    unsetTargetDevHub: () => Effect.void,
    setTargetOrg: () => Effect.void
  } as const)
);

// 5. Mock SettingsService layer (needed by ConnectionService.getConnection)
const MockSettingsServiceLayer = Layer.succeed(
  SettingsService,
  new SettingsService({
    getValue: <T>(_section: string, _key: string, defaultValue?: T) =>
      Effect.try({
        try: () => defaultValue ?? undefined,
        catch: () =>
          new SettingsError({ cause: new Error('Mock error'), section: _section, key: _key, message: 'Mock error' })
      }),
    setValue: <T>(_section: string, _key: string, _value: T) =>
      Effect.tryPromise({
        try: async () => undefined,
        catch: () =>
          new SettingsError({ cause: new Error('Mock error'), section: _section, key: _key, message: 'Mock error' })
      }),
    getInstanceUrl: () => Effect.succeed('https://test.salesforce.com'),
    getAccessToken: () => Effect.succeed('mock-token'),
    getApiVersion: () => Effect.succeed('60.0'),
    setInstanceUrl: (_url: string) =>
      Effect.tryPromise({
        try: async () => undefined,
        catch: () => new SettingsError({ cause: new Error('Mock error'), section: '', key: '', message: 'Mock error' })
      }),
    setAccessToken: (_token: string) =>
      Effect.tryPromise({
        try: async () => undefined,
        catch: () => new SettingsError({ cause: new Error('Mock error'), section: '', key: '', message: 'Mock error' })
      }),
    setApiVersion: (_version: string) =>
      Effect.tryPromise({
        try: async () => undefined,
        catch: () => new SettingsError({ cause: new Error('Mock error'), section: '', key: '', message: 'Mock error' })
      }),
    getRetrieveOnLoad: () => Effect.succeed(''),
    getInternalDev: () => Effect.succeed(false)
  } as const)
);

// 6. Mock ConnectionService layer (needed by activateEffect)
const mockConnection: Connection = {} as Connection;
const MockConnectionServiceLayer = Layer.succeed(
  ConnectionService,
  new ConnectionService({
    getConnection: () => Effect.sync(() => mockConnection),
    getConnectionForOrg: () => Effect.sync(() => mockConnection),
    validateAccessTokenOrPromptReauth: () => Effect.void,
    invalidateCachedConnections: () => Effect.void,
    listAllAuthorizations: () => Effect.succeed([])
  } as const)
);

// 7. Mock ExtensionContextService layer (needed by registerCommand)
const MockExtensionContextServiceLayer = Layer.succeed(
  ExtensionContextService,
  new ExtensionContextService({
    getContext: Effect.sync(() => mockContext),
    getDisplayName: Effect.succeed('Test Extension')
  })
);

// 8. Mock ErrorHandlerService layer (needed by registerCommand)
const MockErrorHandlerServiceLayer = Layer.succeed(
  ErrorHandlerService,
  new ErrorHandlerService({
    handleCause: () => Effect.void
  })
);

// 9. Mock ProjectService layer (needed by retrieveOrgBrowserTreeItemCommand)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockProjectServiceLayer = ProjectService.Default as any as Layer.Layer<ProjectService>;

// 10. Mock MetadataRetrieveService layer (needed by retrieveOrgBrowserTreeItemCommand)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockMetadataRetrieveServiceLayer = MetadataRetrieveService.Default as any as Layer.Layer<MetadataRetrieveService>;

// 11. Mock MetadataRegistryService layer (needed by retrieveOrgBrowserTreeItemCommand)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockMetadataRegistryServiceLayer = MetadataRegistryService.Default as any as Layer.Layer<MetadataRegistryService>;

// 12. Mock SourceTrackingService layer (needed by retrieveOrgBrowserTreeItemCommand)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockSourceTrackingServiceLayer = SourceTrackingService.Default as any as Layer.Layer<SourceTrackingService>;

// 13. Mock OrgBrowserRetrieveService layer (needed by retrieveOrgBrowserTreeItemCommand)

const MockOrgBrowserRetrieveServiceLayer =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  OrgBrowserRetrieveService.Default as any as Layer.Layer<OrgBrowserRetrieveService>;

// 14. ExtensionProviderService mock
const mockServicesApi = {
  services: {
    ChannelService,
    ChannelServiceLayer: MockChannelServiceLayer,
    ComponentSetService: {} as typeof ComponentSetService,
    ConfigService: {} as typeof ConfigService,
    ConnectionService: {} as typeof ConnectionService,
    EditorService: {} as typeof EditorService,
    FsService: {} as typeof FsService,
    MetadataDeleteService: {} as typeof MetadataDeleteService,
    MetadataDeployService: {} as typeof MetadataDeployService,
    MetadataRegistryService: {} as typeof MetadataRegistryService,
    MetadataRetrieveService: {} as typeof MetadataRetrieveService,
    OrgMetadataCatalogChangePubSub,
    ProjectService: {} as typeof ProjectService,
    registerCommandWithRuntime: () => () => Effect.void,
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
  subscriptions: [],
  workspaceState: {
    get: jest.fn(),
    update: jest.fn()
  },
  globalState: {
    get: jest.fn(),
    update: jest.fn()
  }
} as unknown as vscode.ExtensionContext;

describe('Extension activation ordering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.subscriptions.length = 0;
  });

  it('registers the Org Browser UI before waiting for an org ID', async () => {
    const expectedCommands = [
      'sf.org-browser.walkthrough.open',
      'sfdxOrgBrowser.refreshType',
      'sfdxOrgBrowser.collapseAll',
      'sfdxOrgBrowser.retrieveMetadata',
      'sfdxOrgBrowser.showLocal.on',
      'sfdxOrgBrowser.showLocal.off',
      'sfdxOrgBrowser.showOrg.on',
      'sfdxOrgBrowser.showOrg.off',
      'sfdxOrgBrowser.filterText',
      'sfdxOrgBrowser.filterText.active'
    ];
    const registeredCommands: string[] = [];
    const allCommandsRegistered = Promise.withResolvers<void>();
    const initialized = Promise.withResolvers<void>();
    const targetOrgRef = Effect.runSync(SubscriptionRef.make({}));
    const treeProviderDisposable = { dispose: jest.fn() };
    jest.mocked(vscode.window.registerTreeDataProvider).mockReturnValue(treeProviderDisposable);
    jest.mocked(vscode.commands.executeCommand).mockImplementation(async (command, key, value) => {
      if (command === 'setContext' && key === 'sf:orgBrowser.initialized' && value === true) {
        initialized.resolve();
      }
    });
    const servicesApi = {
      services: {
        ChannelService,
        ConnectionService,
        TargetOrgRef: () => Effect.succeed(targetOrgRef),
        registerCommandWithRuntime: () => (command: string) =>
          Effect.sync(() => {
            registeredCommands.push(command);
            if (registeredCommands.length === expectedCommands.length) {
              allCommandsRegistered.resolve();
            }
          })
      }
    } as unknown as SalesforceVSCodeServicesApi;
    const providerLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(servicesApi) as ExtensionProviderServiceType['getServicesApi']
    });
    const activation = activateEffect(mockContext).pipe(
      Effect.provide(
        Layer.mergeAll(
          providerLayer,
          MockChannelServiceLayer('test'),
          MockConnectionServiceLayer,
          MockExtensionContextServiceLayer,
          MockErrorHandlerServiceLayer,
          OrgMetadataCatalogChangePubSub.Default
        )
      )
    );
    const fiber = Effect.runFork(activation);

    try {
      const awaitWithTimeout = async (signal: Promise<void>, message: string): Promise<void> => {
        const timedOut = Promise.withResolvers<never>();
        const timeout = setTimeout(() => timedOut.reject(new Error(message)), 1000);
        try {
          await Promise.race([signal, timedOut.promise]);
        } finally {
          clearTimeout(timeout);
        }
      };
      await awaitWithTimeout(allCommandsRegistered.promise, 'Command registration timed out');
      await awaitWithTimeout(initialized.promise, 'Org Browser initialization timed out');

      expect(vscode.window.registerTreeDataProvider).toHaveBeenCalledWith('sfdxOrgBrowser', expect.anything());
      expect(mockContext.subscriptions).toContain(treeProviderDisposable);
      expect(registeredCommands.toSorted()).toEqual(expectedCommands.toSorted());
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:orgBrowser.initialized', false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:orgBrowser.showLocal', true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:orgBrowser.showOrg', true);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'setContext',
        'sf:orgBrowser.textFilterActive',
        false
      );
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:orgBrowser.treeEmpty', false);
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('setContext', 'sf:orgBrowser.initialized', true);
      expect(Option.isNone(Effect.runSync(Fiber.poll(fiber)))).toBe(true);
    } finally {
      await Effect.runPromise(Fiber.interrupt(fiber));
    }
  });
});

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
            MockConnectionServiceLayer,
            MockExtensionContextServiceLayer,
            MockErrorHandlerServiceLayer,
            MockProjectServiceLayer,
            MockMetadataRetrieveServiceLayer,
            MockMetadataRegistryServiceLayer,
            MockSourceTrackingServiceLayer,
            MockOrgBrowserRetrieveServiceLayer,
            Layer.succeed(NotificationModeService, {
              getProgressLocation: () => Effect.succeed(vscode.ProgressLocation.Notification),
              showSuccessNotification: () => Effect.void
            } as unknown as NotificationModeService),
            OrgMetadataCatalogChangePubSub.Default
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
