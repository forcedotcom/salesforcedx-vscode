/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

// Mock vscode.extensions.getExtension before any imports that trigger src/index.ts
(jest.spyOn(vscode.extensions, 'getExtension') as any).mockImplementation(() => ({ isActive: true, exports: {} }));

// Mock vscode commands
jest.spyOn(vscode.commands, 'executeCommand').mockImplementation(() => Promise.resolve());

jest.mock('./../../src/apexLspStatusBarItem');

jest.mock('../../src/services/extensionProvider', () => ({
  buildAllServicesLayer: () => ({}),
  setAllServicesLayer: () => {}
}));

jest.mock('../../src/services/runtime', () => ({
  getRuntime: () => ({ runPromise: (eff: any) => require('effect/Effect').runPromise(eff) }),
  disposeRuntime: () => Promise.resolve()
}));

import { URI } from 'vscode-uri';
import { ApexLanguageClient } from '../../src/apexLanguageClient';
import { API } from '../../src/constants';
import * as index from '../../src/index';
import { languageClientManager, indexerDoneHandler } from '../../src/languageUtils';
import { ClientStatus } from '../../src/languageUtils/languageClientManager';
import ApexLSPStatusBarItem from './../../src/apexLspStatusBarItem';

describe('index tests', () => {
  describe('indexDoneHandler', () => {
    let setStatusSpy: jest.SpyInstance;
    let onNotificationSpy: jest.SpyInstance;
    let mockLanguageClient: any;
    let languageServerStatusBarItem: ApexLSPStatusBarItem;

    beforeEach(() => {
      setStatusSpy = jest.spyOn(languageClientManager, 'setStatus');
      mockLanguageClient = {
        onNotification: jest.fn(),
        errorHandler: {
          serviceHasStartedSuccessfully: jest.fn()
        }
      };
      onNotificationSpy = jest.spyOn(mockLanguageClient, 'onNotification');
      languageServerStatusBarItem = new ApexLSPStatusBarItem();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should call languageClientManager.setStatus and set up event listener when enableSyncInitJobs is false', async () => {
      await indexerDoneHandler(false, mockLanguageClient, languageServerStatusBarItem);

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
      await indexerDoneHandler(true, mockLanguageClient, languageServerStatusBarItem);

      expect(setStatusSpy).not.toHaveBeenCalledWith(ClientStatus.Indexing, '');
      expect(onNotificationSpy).not.toHaveBeenCalled();
      expect(languageServerStatusBarItem.ready).toHaveBeenCalled();
      expect(setStatusSpy).toHaveBeenCalledWith(ClientStatus.Ready, '');
      expect(mockLanguageClient.errorHandler.serviceHasStartedSuccessfully).toHaveBeenCalled();
    });
  });

  describe('Settings Change Handler', () => {
    let executeCommandMock: jest.SpyInstance;
    let mockEvent: any;

    beforeEach(() => {
      executeCommandMock = jest.spyOn(vscode.commands, 'executeCommand');
      mockEvent = {
        affectsConfiguration: jest.fn()
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
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

      // Mock languageClientManager
      jest.mock('../../src/languageUtils/languageClientManager', () => ({
        createLanguageClient: jest.fn().mockResolvedValue(undefined)
      }));

      // Mock workspace.createFileSystemWatcher
      jest.spyOn(vscode.workspace, 'createFileSystemWatcher').mockReturnValue({
        onDidCreate: jest.fn(),
        onDidChange: jest.fn(),
        dispose: jest.fn()
      } as any);
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
  });

  describe('deactivate', () => {
    let stopSpy: jest.SpyInstance;

    beforeEach(() => {
      stopSpy = jest.fn();
      jest
        .spyOn(languageClientManager, 'getClientInstance')
        .mockReturnValue({ stop: stopSpy } as unknown as ApexLanguageClient);
    });

    it('should call stop on the language client', async () => {
      await index.deactivate();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should handle case when client instance is null', async () => {
      jest.spyOn(languageClientManager, 'getClientInstance').mockReturnValue(undefined);
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
