/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import { SettingsService } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { ApexLanguageClient } from '../../../src/apexLanguageClient';
import ApexLSPStatusBarItem from '../../../src/apexLspStatusBarItem';
import { createLanguageServer } from '../../../src/languageServer';
import { languageClientManager } from '../../../src/languageUtils';
import { ClientStatus, toolsDirsToDelete } from '../../../src/languageUtils/languageClientManager';
import { nls } from '../../../src/messages';
import { getRuntime } from '../../../src/services/runtime';
import { retrieveEnableSyncInitJobs } from '../../../src/settings';
import type { RecordedSpan } from '../testUtils/recordingTracer';

// Typed view of the private isRestarting flag, avoiding `as any` widening in each assertion.
const restartFlag = languageClientManager as unknown as { isRestarting: boolean };

// Spans emitted via getRuntime().runFork are recorded so restart telemetry (name + attributes) can be asserted.
// Prefixed `mock*` so jest.mock's factory may reference it (jest hoists the factory above imports).
const mockRecordedSpans: RecordedSpan[] = [];
const promptService = {
  considerUndefinedAsCancellation: <T>(value: T | undefined) =>
    value === undefined ? Effect.fail(new UserCancellationError()) : Effect.succeed(value)
};
const mockGetSetting = jest.fn((_section: string, _key: string, defaultValue?: unknown) =>
  Effect.succeed(defaultValue)
);

const spanAttributes = (name: string): Record<string, unknown> | undefined => {
  const hit = mockRecordedSpans.find(s => s.name === name);
  return hit ? Object.fromEntries(hit.attributes) : undefined;
};

// forkSync: this suite asserts restart-span attrs synchronously right after runFork, so run the fork
// on the calling stack (runSync) rather than detaching a fiber.
jest.mock('../../../src/services/runtime', () =>
  require('../testUtils/recordingTracer').createRecordingRuntimeMock(() => mockRecordedSpans, {
    forkSync: true,
    settingsGetValue: (...args: [string, string, unknown?]) => mockGetSetting(...args)
  })
);

// Mock ApexLSPStatusBarItem class
jest.mock('../../../src/apexLspStatusBarItem', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    dispose: jest.fn(),
    ready: jest.fn(),
    error: jest.fn(),
    restarting: jest.fn()
  }))
}));

jest.mock('../../../src/languageServer', () => ({
  createLanguageServer: jest.fn()
}));

jest.mock('../../../src/settings', () => ({
  ...jest.requireActual('../../../src/settings'),
  retrieveEnableSyncInitJobs: jest.fn()
}));

// Mock setTimeout and clearTimeout
jest.useFakeTimers();

describe('Language Client Manager', () => {
  describe('Client Status Management', () => {
    it('Should return correct initial status', () => {
      const clientStatus = languageClientManager.getStatus();

      expect(clientStatus.isReady()).toBe(false);
      expect(clientStatus.isIndexing()).toBe(false);
      expect(clientStatus.failedToInitialize()).toBe(false);
      expect(clientStatus.getStatusMessage()).toBe('');
    });

    it('Should return ready status', () => {
      languageClientManager.setStatus(ClientStatus.Ready, 'Apex client is ready');
      const clientStatus = languageClientManager.getStatus();

      expect(clientStatus.isReady()).toBe(true);
      expect(clientStatus.isIndexing()).toBe(false);
      expect(clientStatus.failedToInitialize()).toBe(false);
      expect(clientStatus.getStatusMessage()).toBe('Apex client is ready');
    });

    it('Should return indexing status', () => {
      languageClientManager.setStatus(ClientStatus.Indexing, 'Apex client is indexing');
      const clientStatus = languageClientManager.getStatus();

      expect(clientStatus.isReady()).toBe(false);
      expect(clientStatus.isIndexing()).toBe(true);
      expect(clientStatus.failedToInitialize()).toBe(false);
      expect(clientStatus.getStatusMessage()).toBe('Apex client is indexing');
    });

    it('Should return error status', () => {
      languageClientManager.setStatus(ClientStatus.Error, 'Java version is misconfigured');
      const clientStatus = languageClientManager.getStatus();

      expect(clientStatus.isReady()).toBe(false);
      expect(clientStatus.isIndexing()).toBe(false);
      expect(clientStatus.failedToInitialize()).toBe(true);
      expect(clientStatus.getStatusMessage()).toBe('Java version is misconfigured');
    });

    it('Should return unavailable status', () => {
      languageClientManager.setStatus(ClientStatus.Unavailable, '');
      const clientStatus = languageClientManager.getStatus();

      expect(clientStatus.isReady()).toBe(false);
      expect(clientStatus.isIndexing()).toBe(false);
      expect(clientStatus.failedToInitialize()).toBe(false);
      expect(clientStatus.getStatusMessage()).toBe('');
    });
  });

  describe('Client Instance Management', () => {
    it('Should manage client instance', () => {
      const mockClient = {} as ApexLanguageClient;

      expect(languageClientManager.getClientInstance()).toBeUndefined();

      languageClientManager.setClientInstance(mockClient);
      expect(languageClientManager.getClientInstance()).toBe(mockClient);

      languageClientManager.setClientInstance(undefined);
      expect(languageClientManager.getClientInstance()).toBeUndefined();
    });

    it('Should manage status bar instance', () => {
      const mockLanguageStatusItem = {
        dispose: jest.fn()
      };
      (vscode.languages.createLanguageStatusItem as jest.Mock).mockReturnValue(mockLanguageStatusItem);

      const mockStatusBar = new ApexLSPStatusBarItem();

      expect(languageClientManager.getStatusBarInstance()).toBeUndefined();

      languageClientManager.setStatusBarInstance(mockStatusBar);
      expect(languageClientManager.getStatusBarInstance()).toBe(mockStatusBar);

      languageClientManager.setStatusBarInstance(undefined);
      expect(languageClientManager.getStatusBarInstance()).toBeUndefined();
    });

    it('Should maintain singleton instance', () => {
      const instance1 = languageClientManager;
      const instance2 = languageClientManager;

      expect(instance1).toBe(instance2);

      instance1.setStatus(ClientStatus.Ready, 'test');
      expect(instance2.getStatus().isReady()).toBe(true);
    });
  });

  describe('Client Setup', () => {
    let mockClient: ApexLanguageClient;
    let mockContext: vscode.ExtensionContext;
    let mockStatusBar: ApexLSPStatusBarItem;

    beforeEach(() => {
      jest.clearAllMocks();
      mockRecordedSpans.length = 0;
      const errorHandler = {
        addListener: jest.fn(),
        serviceHasStartedSuccessfully: jest.fn()
      };
      mockClient = {
        errorHandler,
        start: jest.fn().mockResolvedValue(undefined),
        onNotification: jest.fn()
      } as unknown as ApexLanguageClient;
      mockContext = { subscriptions: { push: jest.fn() } } as unknown as vscode.ExtensionContext;
      mockStatusBar = {
        ready: jest.fn(),
        error: jest.fn()
      } as unknown as ApexLSPStatusBarItem;
      (createLanguageServer as unknown as jest.Mock).mockReturnValue(Effect.succeed(mockClient));
      (retrieveEnableSyncInitJobs as jest.Mock).mockReturnValue(Effect.succeed(true));
      languageClientManager.setClientInstance(undefined);
      languageClientManager.setStatus(ClientStatus.Unavailable, '');
    });

    it('keeps createLanguageClient as a Promise adapter', async () => {
      const creation = languageClientManager.createLanguageClient(mockContext, mockStatusBar);

      expect(creation).toBeInstanceOf(Promise);
      await creation;

      expect(mockClient.start).toHaveBeenCalledTimes(1);
      expect(mockStatusBar.ready).toHaveBeenCalledTimes(1);
      expect(languageClientManager.getStatus().isReady()).toBe(true);
      expect(mockContext.subscriptions.push).toHaveBeenCalledWith(mockClient);
    });

    it('reports a typed client start failure through existing status UI', async () => {
      (mockClient.start as jest.Mock).mockRejectedValue(new Error('start failed'));

      await getRuntime().runPromise(languageClientManager.activateLanguageClient(mockContext, mockStatusBar));

      expect(languageClientManager.getStatus().failedToInitialize()).toBe(true);
      expect(languageClientManager.getStatus().getStatusMessage()).toBe('start failed');
      expect(mockStatusBar.error).toHaveBeenCalledWith(
        `${nls.localize('apex_language_server_failed_activate')} - start failed`
      );
      const errSpan = mockRecordedSpans.find(s => s.name === 'apexLSPError');
      expect(errSpan?.attributes.get('error')).toBe('Error: start failed');
      expect(errSpan?.attributes.get('phase')).toBe('start');
      expect(errSpan?.ended).toBe(true);
    });
  });

  describe('Restart Language Server', () => {
    let mockExtensionContext: vscode.ExtensionContext;
    let mockClient: ApexLanguageClient;
    let mockStatusBar: ApexLSPStatusBarItem;
    let setTimeoutSpy: jest.SpyInstance;

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
      jest.clearAllTimers();
      mockRecordedSpans.length = 0;
      mockGetSetting.mockImplementation((_section, _key, defaultValue) => Effect.succeed(defaultValue));

      // Setup setTimeout spy
      setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      // Setup mocks
      mockExtensionContext = {} as vscode.ExtensionContext;
      mockClient = {
        stop: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn()
      } as unknown as ApexLanguageClient;

      // Create a proper mock for the status bar with the restarting method
      mockStatusBar = {
        dispose: jest.fn(),
        ready: jest.fn(),
        error: jest.fn(),
        restarting: jest.fn()
      } as unknown as ApexLSPStatusBarItem;

      // Mock VSCode workspace configuration
      const mockGetConfiguration = jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue('prompt')
      });
      (vscode.workspace.getConfiguration as jest.Mock) = mockGetConfiguration;
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
        isActive: true,
        exports: {
          services: {
            PromptService: Effect.succeed(promptService),
            SettingsService,
            WorkspaceService: {
              getWorkspaceInfo: () => Effect.succeed({ isEmpty: true })
            }
          }
        }
      });

      // Reset the isRestarting flag
      restartFlag.isRestarting = false;

      // Setup client and status bar
      languageClientManager.setClientInstance(mockClient);
      languageClientManager.setStatusBarInstance(mockStatusBar);
    });

    afterEach(() => {
      setTimeoutSpy.mockRestore();
    });

    it('should show information message if already restarting', async () => {
      // Set isRestarting to true
      restartFlag.isRestarting = true;

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext, 'commandPalette');

      // Verify showInformationMessage was called with the correct message
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        nls.localize('apex_language_server_already_restarting')
      );

      // Verify no other actions were taken
      expect(mockClient.stop).not.toHaveBeenCalled();
    });

    it('should cancel operation if no option is selected', async () => {
      // Mock showQuickPick to return undefined (no selection)
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce(undefined);

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext, 'commandPalette');

      // Verify showQuickPick was called
      expect(vscode.window.showQuickPick).toHaveBeenCalled();

      // Verify no other actions were taken
      expect(mockClient.stop).not.toHaveBeenCalled();
      expect(mockStatusBar.restarting).not.toHaveBeenCalled();
    });

    it('should restart without cleaning DB when restart only option is selected', async () => {
      // Mock showQuickPick to return the restart only option
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce({
        label: nls.localize('apex_language_server_restart_dialog_restart_only'),
        type: 'restart'
      });

      // Mock createLanguageClient to resolve immediately
      jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext, 'commandPalette');

      // Verify client was stopped
      expect(mockClient.stop).toHaveBeenCalled();

      // Verify status bar was updated
      expect(mockStatusBar.restarting).toHaveBeenCalled();

      // Fast-forward timers and wait for promises to resolve
      jest.runAllTimers();
      await Promise.resolve();

      // Verify createLanguageClient was called
      expect(languageClientManager.createLanguageClient).toHaveBeenCalled();
    });

    it('should restart and clean DB when clean and restart option is selected', async () => {
      // Mock showQuickPick to return the clean and restart option
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce({
        label: nls.localize('apex_language_server_restart_dialog_clean_and_restart'),
        type: 'reset'
      });

      // Services extension resolves with a non-empty workspace so removeApexDB reaches the delete branch.
      const workspaceUri = URI.parse('file:///workspace');
      const toolsUri = Utils.joinPath(workspaceUri, '.sfdx', 'tools');
      // FsService.readDirectoryWithTypes yields typed entries; safeDelete records the URIs it removes.
      const safeDelete = jest.fn().mockImplementation(() => Effect.void);
      (vscode.extensions.getExtension as jest.Mock).mockReturnValue({
        isActive: true,
        exports: {
          services: {
            PromptService: Effect.succeed(promptService),
            SettingsService,
            WorkspaceService: {
              getWorkspaceInfo: () =>
                Effect.succeed({
                  uri: workspaceUri,
                  path: workspaceUri.path,
                  fsPath: workspaceUri.fsPath,
                  isEmpty: false,
                  isVirtualFs: false,
                  cwd: '/workspace'
                })
            },
            FsService: {
              // Two NNN dirs and a non-matching entry.
              readDirectoryWithTypes: () =>
                Effect.succeed([
                  { uri: Utils.joinPath(toolsUri, '123'), type: vscode.FileType.Directory },
                  { uri: Utils.joinPath(toolsUri, '456'), type: vscode.FileType.Directory },
                  { uri: Utils.joinPath(toolsUri, 'notes'), type: vscode.FileType.File }
                ]),
              safeDelete
            }
          }
        }
      });

      // Mock createLanguageClient to resolve immediately
      jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext, 'commandPalette');

      // Verify client was stopped
      expect(mockClient.stop).toHaveBeenCalled();

      // Verify status bar was updated
      expect(mockStatusBar.restarting).toHaveBeenCalled();

      // Only the NNN tools dirs are deleted (behavior preserved).
      expect(safeDelete).toHaveBeenCalledTimes(2);
      const deletedPaths = safeDelete.mock.calls.map(([uri]: [URI]) => uri.path).toSorted();
      expect(deletedPaths).toEqual(['/workspace/.sfdx/tools/123', '/workspace/.sfdx/tools/456']);

      // Fast-forward timers and wait for promises to resolve
      jest.runAllTimers();
      await Promise.resolve();

      // Verify createLanguageClient was called
      expect(languageClientManager.createLanguageClient).toHaveBeenCalled();
    });

    it('should complete restart without stranding isRestarting when services extension is unavailable', async () => {
      // Mock showQuickPick to return the clean and restart option
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce({
        label: nls.localize('apex_language_server_restart_dialog_clean_and_restart'),
        type: 'reset'
      });

      // No services extension → getServicesApi fails ServicesExtensionNotFoundError.
      const settingsApi = {
        isActive: true,
        exports: { services: { SettingsService } }
      };
      const promptApi = {
        isActive: true,
        exports: { services: { PromptService: Effect.succeed(promptService) } }
      };
      (vscode.extensions.getExtension as jest.Mock)
        .mockReturnValueOnce(settingsApi)
        .mockReturnValueOnce(promptApi)
        .mockReturnValue(undefined);

      // Mock createLanguageClient to resolve immediately
      jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

      // Call the method — must resolve, not reject.
      await expect(
        languageClientManager.restartLanguageServerAndClient(mockExtensionContext, 'commandPalette')
      ).resolves.toBeUndefined();

      // DB cleanup skipped since there's no services extension.
      expect(vscode.workspace.fs.delete).not.toHaveBeenCalled();

      // Fast-forward timers and drain the setTimeout callback's async chain (dispose → create → finally)
      // without coupling to its internal await depth.
      await jest.runAllTimersAsync();

      // Restart still completed and the flag was reset (a follow-up restart won't short-circuit).
      expect(languageClientManager.createLanguageClient).toHaveBeenCalled();
      expect(restartFlag.isRestarting).toBe(false);
    });

    it('should handle errors during client stop', async () => {
      // Mock showQuickPick to return the restart only option
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce({
        label: nls.localize('apex_language_server_restart_dialog_restart_only'),
        type: 'restart'
      });

      // Mock client.stop to throw an error
      const errorMessage = 'Test error';
      (mockClient.stop as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      // Mock createLanguageClient to resolve immediately
      jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext, 'commandPalette');

      // Verify showWarningMessage was called with the correct message
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        `${nls.localize('apex_language_server_restart_dialog_restart_only')} - ${errorMessage}`
      );

      // Fast-forward timers and wait for promises to resolve
      jest.runAllTimers();
      await Promise.resolve();

      // Verify createLanguageClient was called
      expect(languageClientManager.createLanguageClient).toHaveBeenCalled();
    });

    it('should reset isRestarting flag if there is no client instance', async () => {
      // Set client instance to undefined
      languageClientManager.setClientInstance(undefined);

      // Mock showQuickPick to return the restart only option
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce(
        nls.localize('apex_language_server_restart_dialog_restart_only')
      );

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext, 'commandPalette');

      // Verify isRestarting was reset
      expect(restartFlag.isRestarting).toBe(false);
    });

    describe('Restart Behavior Setting', () => {
      it('should use prompt behavior by default', async () => {
        // Mock showQuickPick to return the restart only option
        (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce({
          label: nls.localize('apex_language_server_restart_dialog_restart_only'),
          type: 'restart'
        });

        // Mock createLanguageClient to resolve immediately
        jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

        // Call the method
        await languageClientManager.restartLanguageServerAndClient(mockExtensionContext, 'commandPalette');

        // Verify showQuickPick was called
        expect(vscode.window.showQuickPick).toHaveBeenCalled();

        // Verify restart telemetry span carries the expected attributes
        expect(spanAttributes('apex.lsp.restart')).toEqual({
          restartBehavior: 'prompt',
          selectedOption: 'restart',
          source: 'commandPalette',
          defaultOption: 'prompt'
        });
      });

      it('should use restart behavior when configured', async () => {
        mockGetSetting.mockReturnValue(Effect.succeed('restart'));

        // Mock createLanguageClient to resolve immediately
        jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

        // Call the method
        await languageClientManager.restartLanguageServerAndClient(mockExtensionContext, 'statusBar');

        // Verify showQuickPick was not called
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();

        // Verify restart telemetry span carries the expected attributes
        expect(spanAttributes('apex.lsp.restart')).toEqual({
          restartBehavior: 'restart',
          selectedOption: 'restart',
          source: 'statusBar',
          defaultOption: 'restart'
        });
      });

      it('should use reset behavior when configured', async () => {
        mockGetSetting.mockReturnValue(Effect.succeed('reset'));

        // Mock showQuickPick to return the reset option
        (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce({
          label: nls.localize('apex_language_server_restart_dialog_clean_and_restart'),
          type: 'reset'
        });

        // Mock createLanguageClient to resolve immediately
        jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

        // Reset any previous calls to showQuickPick
        (vscode.window.showQuickPick as jest.Mock).mockClear();

        // Call the method
        await languageClientManager.restartLanguageServerAndClient(mockExtensionContext, 'commandPalette');

        // Verify showQuickPick was called with reset option first
        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(
          [
            {
              label: nls.localize('apex_language_server_restart_dialog_clean_and_restart'),
              description: '',
              type: 'reset'
            },
            {
              label: nls.localize('apex_language_server_restart_dialog_restart_only'),
              description: '',
              type: 'restart'
            }
          ],
          expect.any(Object)
        );

        // Verify restart telemetry span carries the expected attributes
        expect(spanAttributes('apex.lsp.restart')).toEqual({
          restartBehavior: 'reset',
          selectedOption: 'reset',
          source: 'commandPalette',
          defaultOption: 'reset'
        });

        // Verify client was stopped
        expect(mockClient.stop).toHaveBeenCalled();

        // Verify status bar was updated
        expect(mockStatusBar.restarting).toHaveBeenCalled();

        // Fast-forward timers and wait for promises to resolve
        jest.runAllTimers();
        await Promise.resolve();

        // Verify createLanguageClient was called
        expect(languageClientManager.createLanguageClient).toHaveBeenCalled();
      });
    });
  });

  describe('toolsDirsToDelete', () => {
    const base = URI.parse('file:///workspace/.sfdx/tools');
    const entry = (name: string, type: vscode.FileType) => ({ uri: Utils.joinPath(base, name), type });

    it('keeps only NNN-named directories', () => {
      const result = toolsDirsToDelete([
        entry('123', vscode.FileType.Directory),
        entry('456', vscode.FileType.Directory),
        entry('notes', vscode.FileType.File),
        entry('12', vscode.FileType.Directory),
        entry('1234', vscode.FileType.Directory),
        entry('789', vscode.FileType.File)
      ]);
      expect(result.map(uri => uri.path)).toEqual(['/workspace/.sfdx/tools/123', '/workspace/.sfdx/tools/456']);
    });

    it('returns empty for no matches', () => {
      expect(toolsDirsToDelete([])).toEqual([]);
      expect(toolsDirsToDelete([entry('abc', vscode.FileType.Directory)])).toEqual([]);
    });
  });
});
