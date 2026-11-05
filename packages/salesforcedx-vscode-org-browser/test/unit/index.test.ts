/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  ChannelService,
  ConnectionService,
  type DefaultOrgInfoSchema,
  ErrorHandlerService,
  ExtensionContextService,
  OrgMetadataCatalog,
  OrgMetadataCatalogChangePubSub,
  TargetOrgRef,
  type SalesforceVSCodeServicesApiV2
} from '@salesforce/vscode-services/v2';
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import * as Scope from 'effect/Scope';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import * as vscode from 'vscode';
import { createMockOutputChannel } from 'salesforcedx-vscode-services/test/unit/testUtils';
import { activateEffect } from '../../src/index';

vi.mock('vscode', () => ({
  window: {
    registerTreeDataProvider: vi.fn()
  },
  commands: {
    registerCommand: vi.fn(),
    executeCommand: vi.fn()
  },
  workspace: {
    getConfiguration: vi.fn(() => ({ get: vi.fn() }))
  },
  ExtensionContext: vi.fn(),
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  TreeItem: class {},
  EventEmitter: class {
    public event = vi.fn();
    public fire = vi.fn();
    public dispose = vi.fn();
  },
  env: {
    createTelemetryLogger: vi.fn(() => ({
      logUsage: vi.fn(),
      logError: vi.fn(),
      dispose: vi.fn(),
      onDidChangeEnableStates: vi.fn()
    }))
  }
}));

const mockAppendLine = vi.fn();
const mockOutputChannel = createMockOutputChannel();
mockOutputChannel.appendLine = mockAppendLine;
const channelService = ChannelService.of({
  getChannel: Effect.sync(() => mockOutputChannel),
  showChannel: Effect.void,
  clearChannel: Effect.void,
  appendToChannel: (message: string) => Effect.sync(() => mockAppendLine(message))
});
const mockConnection: Connection = {} as Connection;
const mockContext = {
  subscriptions: [],
  extension: { packageJSON: { version: '1.0.0' } },
  workspaceState: { get: vi.fn(), update: vi.fn(() => Promise.resolve()) },
  globalState: { get: vi.fn(), update: vi.fn(() => Promise.resolve()) }
} as unknown as vscode.ExtensionContext;

describe('Extension activation ordering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.subscriptions.length = 0;
  });

  it('registers the Org Browser UI without waiting for an org ID or opening a connection', async () => {
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
    const targetOrgRef = Effect.runSync(SubscriptionRef.make<typeof DefaultOrgInfoSchema.Type>({}));
    const treeProviderDisposable = { dispose: vi.fn() };
    vi.mocked(vscode.window.registerTreeDataProvider).mockReturnValue(treeProviderDisposable);
    vi.mocked(vscode.commands.executeCommand).mockImplementation(async (command, key, value) => {
      if (command === 'setContext' && key === 'sf:orgBrowser.initialized' && value === true) initialized.resolve();
    });

    const connectionService = ConnectionService.of({
      getConnection: () => Effect.sync(() => mockConnection)
    } as unknown as ConnectionService['Service']);
    const getConnection = vi.spyOn(connectionService, 'getConnection');
    const api = {
      v2: {
        services: {
          ChannelService,
          ConnectionService,
          TargetOrgRef,
          OrgMetadataCatalog,
          OrgMetadataCatalogChangePubSub,
          registerCommandWithRuntime: () => (command: string) =>
            Effect.sync(() => {
              registeredCommands.push(command);
              if (registeredCommands.length === expectedCommands.length) allCommandsRegistered.resolve();
            })
        }
      }
    } as unknown as SalesforceVSCodeServicesApiV2;
    const providerLayer = Layer.succeed(ExtensionProviderService, {
      getServicesApi: Effect.succeed(api)
    } as unknown as ExtensionProviderService['Service']);
    const catalog = {
      getChildren: () => Effect.succeed([])
    } as unknown as OrgMetadataCatalog['Service'];
    const extensionContextService = ExtensionContextService.of({
      scope: Effect.runSync(Scope.make()),
      getContext: Effect.succeed(mockContext),
      getDisplayName: Effect.succeed('Test Extension')
    });
    const errorHandlerService = ErrorHandlerService.of({ handleCause: () => Effect.void });
    const activation = activateEffect(mockContext).pipe(
      Effect.provide(
        Layer.mergeAll(
          providerLayer,
          Layer.succeed(ChannelService, channelService),
          Layer.succeed(ConnectionService, connectionService),
          Layer.succeed(TargetOrgRef, targetOrgRef),
          Layer.succeed(OrgMetadataCatalog, catalog),
          Layer.succeed(ExtensionContextService, extensionContextService),
          Layer.succeed(ErrorHandlerService, errorHandlerService),
          Layer.effect(OrgMetadataCatalogChangePubSub, PubSub.unbounded())
        )
      )
    );
    const fiber = Effect.runFork(Effect.scoped(activation));

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
      expect(getConnection).not.toHaveBeenCalled();
    } finally {
      await Effect.runPromise(Fiber.interrupt(fiber));
    }
  });
});
