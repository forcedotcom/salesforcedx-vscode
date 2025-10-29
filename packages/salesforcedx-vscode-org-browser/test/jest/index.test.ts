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
import { Effect, Context, Layer } from 'effect';
import { activateEffect, deactivateEffect } from '../../src/index';
import { ExtensionProviderService } from '../../src/services/extensionProvider';
import { ConnectionService } from 'salesforcedx-vscode-services/src/core/connectionService';
import { ProjectService } from 'salesforcedx-vscode-services/src/core/projectService';
import { WorkspaceService } from 'salesforcedx-vscode-services/src/vscode/workspaceService';
import { FsService } from 'salesforcedx-vscode-services/src/vscode/fsService';
import { ConfigService } from 'salesforcedx-vscode-services/src/core/configService';
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

// 2. ChannelService mock
const mockChannelService = {
  getChannel: Effect.sync(() => mockOutputChannel),
  appendToChannel: (message: string): Effect.Effect<void> => Effect.sync(() => mockAppendLine(message))
};
const MockChannelService = Context.GenericTag<typeof mockChannelService>('ChannelService');
const MockChannelServiceLayer = (_: string): Layer.Layer<typeof mockChannelService> =>
  Layer.effect(
    MockChannelService,
    Effect.sync(() => mockChannelService)
  );

// 3. ExtensionProviderService mock
const MockExtensionProviderServiceLive = Layer.effect(
  ExtensionProviderService,
  Effect.sync(() => ({
    getServicesApi: Effect.sync(
      () =>
        ({
          services: {
            ConnectionService: {} as typeof ConnectionService,
            ProjectService: {} as typeof ProjectService,
            ChannelService: MockChannelService,
            ChannelServiceLayer: MockChannelServiceLayer,
            WorkspaceService,
            FsService,
            ConfigService,
            MetadataRetrieveService: {} as typeof ConnectionService // Use a real type if available
          }
        }) as unknown as SalesforceVSCodeServicesApi
    )
  }))
);

const mockContext = {
  subscriptions: []
} as unknown as vscode.ExtensionContext;

describe.skip('Extension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should activate successfully', async () => {
    await Effect.runPromise(Effect.provide(activateEffect(mockContext), MockExtensionProviderServiceLive));
    expect(mockAppendLine).toHaveBeenCalledWith('Salesforce Org Browser extension is now active!');
  });

  it('should deactivate successfully', async () => {
    await Effect.runPromise(Effect.provide(deactivateEffect, MockExtensionProviderServiceLive));
    expect(mockAppendLine).toHaveBeenCalledWith('Salesforce Org Browser extension is now deactivated!');
  });
});
