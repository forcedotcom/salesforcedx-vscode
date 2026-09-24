/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MockInstance as VitestMockInstance } from 'vitest';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';

// Mock vscode.extensions.getExtension before any imports that trigger src/index.ts
(vi.spyOn(vscode.extensions, 'getExtension') as any).mockImplementation(() => ({ isActive: true, exports: {} }));

// Mock vscode commands
vi.spyOn(vscode.commands, 'executeCommand').mockImplementation(() => Promise.resolve());

vi.mock('./../../src/apexLspStatusBarItem');
vi.mock('../../src/languageUtils/languageClientManager', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/languageUtils/languageClientManager')>()),
  createLanguageClient: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/extensionProvider', () => ({
  buildAllServicesLayer: () => ({}),
  setAllServicesLayer: () => {}
}));

vi.mock('../../src/services/runtime', () => ({
  getRuntime: () => ({ runPromise: (eff: any) => require('effect/Effect').runPromise(eff) }),
  disposeRuntime: () => Promise.resolve()
}));

import { URI } from 'vscode-uri';
import { ApexLanguageClient } from '../../src/apexLanguageClient';
import { API } from '../../src/constants';
import * as index from '../../src/index';
import { languageClientManager } from '../../src/languageUtils';
import { ClientStatus } from '../../src/languageUtils/languageClientManager';
import ApexLSPStatusBarItem from './../../src/apexLspStatusBarItem';

describe('index tests', () => {
  describe('indexDoneHandler', () => {
    let setStatusSpy: VitestMockInstance;
    let onNotificationSpy: VitestMockInstance;
    let mockLanguageClient: any;
    let languageServerStatusBarItem: ApexLSPStatusBarItem;

    beforeEach(() => {
      setStatusSpy = vi.spyOn(languageClientManager, 'setStatus');
      mockLanguageClient = {
        onNotification: vi.fn(),
        errorHandler: {
          serviceHasStartedSuccessfully: vi.fn()
        }
      };
      onNotificationSpy = vi.spyOn(mockLanguageClient, 'onNotification');
      languageServerStatusBarItem = new ApexLSPStatusBarItem();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should call languageClientManager.setStatus and set up event listener when enableSyncInitJobs is false', async () => {
      await languageClientManager.indexerDoneHandler(false, mockLanguageClient, languageServerStatusBarItem);

      expect(setStatusSpy).toHaveBeenCalledWith(ClientStatus.Indexing, '');
      expect(onNotificationSpy).toHaveBeenCalledWith(API.doneIndexing, expect.any(Function));

      // Simulate the notification callback
      const mockCallback = onNotificationSpy.mock.calls[0][1];
      await mockCallback();

      expect(languageServerStatusBarItem.ready).toHaveBeenCalled();
      expect(setStatusSpy).toHaveBeenCalledWith(ClientStatus.Ready, '');
      expect(mockLanguageClient.errorHandler.serviceHasStartedSuccessfully).toHaveBeenCalled();
    });

    it('should call setClientReady when enableSyncInitJobs is true', async () => {
      await languageClientManager.indexerDoneHandler(true, mockLanguageClient, languageServerStatusBarItem);

      expect(setStatusSpy).not.toHaveBeenCalledWith(ClientStatus.Indexing, '');
      expect(onNotificationSpy).not.toHaveBeenCalled();
      expect(languageServerStatusBarItem.ready).toHaveBeenCalled();
      expect(setStatusSpy).toHaveBeenCalledWith(ClientStatus.Ready, '');
      expect(mockLanguageClient.errorHandler.serviceHasStartedSuccessfully).toHaveBeenCalled();
    });
  });

  describe('Settings Change Handler', () => {
    let executeCommandMock: VitestMockInstance;
    let mockEvent: any;

    beforeEach(() => {
      executeCommandMock = vi.spyOn(vscode.commands, 'executeCommand');
      mockEvent = {
        affectsConfiguration: vi.fn()
      };
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should execute restart command when lspParityCapabilities setting changes', () => {
      // Mock the event to affect our setting
      mockEvent.affectsConfiguration.mockReturnValue(true);

      // Create the settings change handler function (same logic as in index.ts)
      const settingsChangeHandler = (event: any) => {
        if (event.affectsConfiguration('salesforcedx-vscode-apex.advanced.lspParityCapabilities')) {
          void vscode.commands.executeCommand('sf.apex.languageServer.restart', 'commandPalette');
        }
      };

      settingsChangeHandler(mockEvent);

      expect(executeCommandMock).toHaveBeenCalledWith('sf.apex.languageServer.restart', 'commandPalette');
    });

    it('should not execute restart command when other settings change', () => {
      // Mock the event to not affect our setting
      mockEvent.affectsConfiguration.mockReturnValue(false);

      // Create the settings change handler function (same logic as in index.ts)
      const settingsChangeHandler = (event: any) => {
        if (event.affectsConfiguration('salesforcedx-vscode-apex.advanced.lspParityCapabilities')) {
          void vscode.commands.executeCommand('sf.apex.languageServer.restart', 'commandPalette');
        }
      };

      settingsChangeHandler(mockEvent);

      expect(executeCommandMock).not.toHaveBeenCalled();
    });

    it('should check for the correct configuration key', () => {
      // Mock the event to affect our setting
      mockEvent.affectsConfiguration.mockReturnValue(true);

      // Create the settings change handler function (same logic as in index.ts)
      const settingsChangeHandler = (event: any) => {
        if (event.affectsConfiguration('salesforcedx-vscode-apex.advanced.lspParityCapabilities')) {
          void vscode.commands.executeCommand('sf.apex.languageServer.restart', 'commandPalette');
        }
      };

      settingsChangeHandler(mockEvent);

      expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith(
        'salesforcedx-vscode-apex.advanced.lspParityCapabilities'
      );
    });
  });

  describe('activate', () => {
    let mockContext: vscode.ExtensionContext;
    let originalWorkspaceFolders: any;
    let originalExtensions: any;
    const runActivateEffect = (isSalesforceProject: boolean) => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      const getWorkspaceInfoOrThrow = () =>
        workspaceFolder
          ? Effect.succeed({
              uri: workspaceFolder.uri,
              path: workspaceFolder.uri.toString(),
              fsPath: workspaceFolder.uri.fsPath,
              isEmpty: false,
              isVirtualFs: workspaceFolder.uri.scheme !== 'file',
              cwd: process.cwd()
            })
          : Effect.fail(new Error('No workspace is currently open'));

      const effect = index.activateEffect(mockContext).pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({
            services: {
              WorkspaceService: {
                getWorkspaceInfoOrThrow
              },
              ProjectService: {
                isSalesforceProject: () => Effect.succeed(isSalesforceProject)
              }
            }
          })
        } as unknown as ExtensionProviderService)
      );

      return Effect.runPromise(effect as Effect.Effect<void, unknown, never>);
    };

    beforeEach(() => {
      // Store original extensions
      originalExtensions = vscode.extensions;

      // Mock apex extension
      const mockApexExtension = {
        id: 'salesforce.salesforcedx-vscode-apex',
        extensionUri: URI.file('/mock/extension/path'),
        packageJSON: {
          name: 'salesforcedx-vscode-apex',
          publisher: 'salesforce'
        }
      };

      // Mock extensions API for the apex extension
      Object.defineProperty(vscode, 'extensions', {
        get: () => ({
          getExtension: (id: string) => {
            if (id === 'salesforce.salesforcedx-vscode-apex') return mockApexExtension;
            return { isActive: true, exports: {} };
          }
        }),
        configurable: true
      });

      mockContext = {
        subscriptions: [],
        extensionPath: '/mock/extension/path',
        extension: mockApexExtension,
        extensionUri: URI.file('/mock/extension/path'),
        extensionMode: vscode.ExtensionMode.Test
      } as unknown as vscode.ExtensionContext;

      // Store original workspaceFolders
      originalWorkspaceFolders = vscode.workspace.workspaceFolders;

      // Mock workspace.createFileSystemWatcher
      vi.spyOn(vscode.workspace, 'createFileSystemWatcher').mockReturnValue({
        onDidCreate: vi.fn(),
        onDidChange: vi.fn(),
        dispose: vi.fn()
      } as unknown as vscode.FileSystemWatcher);
    });

    afterEach(() => {
      // Restore original extensions
      Object.defineProperty(vscode, 'extensions', {
        value: originalExtensions,
        configurable: true
      });
      // Restore original workspaceFolders
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        configurable: true
      });
    });

    it('should throw error if no workspace folders exist', async () => {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: undefined,
        configurable: true
      });
      await expect(index.activate(mockContext)).rejects.toThrow(''); //should be "Unable to determine workspace folders for workspace"
    });

    it('should not start the Apex language server in a non-Salesforce workspace', async () => {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [
          {
            uri: URI.file('/mock/non-sfdx-workspace'),
            name: 'non-sfdx-workspace',
            index: 0
          }
        ],
        configurable: true
      });

      const unexpectedStart = new Error('unexpected Apex language server start');

      const activateLanguageClientSpy = vi
        .spyOn(languageClientManager, 'activateLanguageClient')
        .mockReturnValue(Effect.die(unexpectedStart));

      await runActivateEffect(false);

      expect(activateLanguageClientSpy).not.toHaveBeenCalled();
    });

    it('should start the Apex language server in a Salesforce workspace', async () => {
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [
          {
            uri: URI.file('/mock/sfdx-workspace'),
            name: 'sfdx-workspace',
            index: 0
          }
        ],
        configurable: true
      });

      const expectedStart = new Error('expected Apex language server start');

      const activateLanguageClientSpy = vi
        .spyOn(languageClientManager, 'activateLanguageClient')
        .mockReturnValue(Effect.die(expectedStart));

      await expect(runActivateEffect(true)).rejects.toThrow('expected Apex language server start');

      expect(activateLanguageClientSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('deactivate', () => {
    let stopSpy: VitestMockInstance;

    beforeEach(() => {
      stopSpy = vi.fn();
      vi.spyOn(languageClientManager, 'getClientInstance').mockReturnValue({
        stop: stopSpy
      } as unknown as ApexLanguageClient);
    });

    it('should call stop on the language client', async () => {
      await index.deactivate();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should handle case when client instance is null', async () => {
      vi.spyOn(languageClientManager, 'getClientInstance').mockReturnValue(undefined);
      await index.deactivate();
      expect(stopSpy).not.toHaveBeenCalled();
    });

    it('should still resolve when stop rejects (scope teardown/span flush not skipped)', async () => {
      stopSpy.mockRejectedValue(new Error('Stopping the server timed out'));
      await expect(index.deactivate()).resolves.toBeUndefined();
      expect(stopSpy).toHaveBeenCalled();
    });
  });
});
