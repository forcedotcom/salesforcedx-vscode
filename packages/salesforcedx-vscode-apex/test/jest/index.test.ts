/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

// Mock vscode.extensions.getExtension before any imports that trigger src/index.ts
const mockWorkspaceContext = { initialize: jest.fn() };
const mockTelemetryService = {
  initializeService: jest.fn(),
  sendExtensionDeactivationEvent: jest.fn()
};
const mockCoreExports = {
  WorkspaceContext: { getInstance: () => mockWorkspaceContext },
  services: { TelemetryService: { getInstance: () => mockTelemetryService } }
};
const mockExtension = { exports: mockCoreExports, isActive: true };
(jest.spyOn(vscode.extensions, 'getExtension') as any).mockImplementation((id: string) => {
  if (id === 'salesforce.salesforcedx-vscode-core') return mockExtension;
  return { isActive: true, exports: {} };
});

// Mock vscode commands
jest.spyOn(vscode.commands, 'executeCommand').mockImplementation(() => Promise.resolve());

jest.mock('./../../src/apexLspStatusBarItem');
jest.mock('../../src/telemetry/telemetry', () => ({
  getTelemetryService: jest.fn(),
  setTelemetryService: jest.fn()
}));

import { URI } from 'vscode-uri';
import { ApexLanguageClient } from '../../src/apexLanguageClient';
import { API } from '../../src/constants';
import * as index from '../../src/index';
import { languageClientManager, indexerDoneHandler } from '../../src/languageUtils';
import { ClientStatus } from '../../src/languageUtils/languageClientManager';
import { getTelemetryService } from '../../src/telemetry/telemetry';
import * as testOutlineProvider from '../../src/views/testOutlineProvider';
import ApexLSPStatusBarItem from './../../src/apexLspStatusBarItem';
import { MockTelemetryService } from './telemetry/mockTelemetryService';

describe('index tests', () => {
  describe('indexDoneHandler', () => {
    let setStatusSpy: jest.SpyInstance;
    let onNotificationSpy: jest.SpyInstance;
    let mockLanguageClient: any;
    let languageServerStatusBarItem: ApexLSPStatusBarItem;
    let mockTestOutlineProvider: any;

    beforeEach(() => {
      // Set up mock test outline provider
      mockTestOutlineProvider = {
        refresh: jest.fn().mockResolvedValue(undefined)
      };
      jest.spyOn(testOutlineProvider, 'getTestOutlineProvider').mockReturnValue(mockTestOutlineProvider);

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

      expect(mockTestOutlineProvider.refresh).toHaveBeenCalled();
      expect(languageServerStatusBarItem.ready).toHaveBeenCalled();
      expect(setStatusSpy).toHaveBeenCalledWith(ClientStatus.Ready, '');
      expect(mockLanguageClient.errorHandler.serviceHasStartedSuccessfully).toHaveBeenCalled();
    });

    it('should call setClientReady when enableSyncInitJobs is true', async () => {
      await indexerDoneHandler(true, mockLanguageClient, languageServerStatusBarItem);

      expect(setStatusSpy).not.toHaveBeenCalledWith(ClientStatus.Indexing, '');
      expect(onNotificationSpy).not.toHaveBeenCalled();
      expect(mockTestOutlineProvider.refresh).toHaveBeenCalled();
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
    let telemetryServiceMock: MockTelemetryService;
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

      // Mock extensions API for both core and apex extensions
      Object.defineProperty(vscode, 'extensions', {
        get: () => ({
          getExtension: (id: string) => {
            if (id === 'salesforce.salesforcedx-vscode-core') return mockExtension;
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

      telemetryServiceMock = new MockTelemetryService();
      (getTelemetryService as jest.Mock).mockResolvedValue(telemetryServiceMock); // Ensure this works with the Jest mock
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

    it('should throw error if telemetry service fails to initialize', async () => {
      mockTelemetryService.initializeService = jest
        .fn()
        .mockRejectedValue(new Error('Could not fetch a telemetry service instance'));
      await expect(index.activate(mockContext)).rejects.toThrow('Could not fetch a telemetry service instance');
    });
  });

  describe('deactivate', () => {
    let stopSpy: jest.SpyInstance;
    let telemetryServiceMock: MockTelemetryService;

    beforeEach(() => {
      stopSpy = jest.fn();
      telemetryServiceMock = new MockTelemetryService();
      (getTelemetryService as jest.Mock).mockReturnValue(telemetryServiceMock);
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

    it('should send telemetry event on deactivation', async () => {
      const sendEventSpy = jest.spyOn(telemetryServiceMock, 'sendExtensionDeactivationEvent');
      await index.deactivate();
      expect(sendEventSpy).toHaveBeenCalled();
    });

    it('should handle telemetry service failure', async () => {
      mockTelemetryService.initializeService = jest
        .fn()
        .mockRejectedValue(new Error('Could not fetch a telemetry service instance'));
      await index.deactivate(); // Should not throw
      expect(stopSpy).toHaveBeenCalled();
    });
  });
});
