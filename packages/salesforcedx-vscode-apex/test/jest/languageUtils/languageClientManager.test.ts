/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as child_process from 'node:child_process';
import * as vscode from 'vscode';
import { ApexLanguageClient } from '../../../src/apexLanguageClient';
import ApexLSPStatusBarItem from '../../../src/apexLspStatusBarItem';
import { UBER_JAR_NAME } from '../../../src/constants';
import { languageClientManager } from '../../../src/languageUtils';
import { ClientStatus } from '../../../src/languageUtils/languageClientManager';
import { nls } from '../../../src/messages';
import { getTelemetryService } from '../../../src/telemetry/telemetry';
import { MockTelemetryService } from '../telemetry/mockTelemetryService';

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

jest.mock('../../../src/telemetry/telemetry', () => ({
  getTelemetryService: jest.fn()
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

  describe('Orphaned Process Management', () => {
    beforeEach(() => {
      (getTelemetryService as jest.Mock).mockResolvedValue(new MockTelemetryService());
    });

    it('should return empty array if no processes found', async () => {
      jest.spyOn(child_process, 'execSync').mockReturnValue(Buffer.from(''));
      jest.spyOn(languageClientManager, 'canRunCheck').mockImplementation((isWindows: boolean) => true);

      const result = await languageClientManager.findAndCheckOrphanedProcesses();
      expect(result).toHaveLength(0);
    });

    it('should return empty array if no orphaned processes found', async () => {
      jest
        .spyOn(child_process, 'execSync')
        .mockReturnValueOnce(Buffer.from(`1234 5678 ${UBER_JAR_NAME}`))
        .mockReturnValueOnce(Buffer.from(''));
      jest.spyOn(languageClientManager, 'canRunCheck').mockImplementation((isWindows: boolean) => true);

      const result = await languageClientManager.findAndCheckOrphanedProcesses();
      expect(result).toHaveLength(0);
    });

    it('should return array of orphaned processes', async () => {
      jest
        .spyOn(child_process, 'execSync')
        .mockReturnValueOnce(Buffer.from(`1234 5678 ${UBER_JAR_NAME}`))
        .mockImplementationOnce(() => {
          throw new Error();
        });
      jest.spyOn(languageClientManager, 'canRunCheck').mockImplementation((isWindows: boolean) => true);

      const result = await languageClientManager.findAndCheckOrphanedProcesses();
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('pid', 1234);
    });
  });

  describe('Restart Language Server', () => {
    let mockExtensionContext: vscode.ExtensionContext;
    let mockClient: ApexLanguageClient;
    let mockStatusBar: ApexLSPStatusBarItem;
    let setTimeoutSpy: jest.SpyInstance;
    let mockTelemetryService: MockTelemetryService;

    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
      jest.clearAllTimers();

      // Setup setTimeout spy
      setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      // Setup mocks
      mockExtensionContext = {} as vscode.ExtensionContext;
      mockClient = {
        stop: jest.fn().mockResolvedValue(undefined)
      } as unknown as ApexLanguageClient;

      // Create a proper mock for the status bar with the restarting method
      mockStatusBar = {
        dispose: jest.fn(),
        ready: jest.fn(),
        error: jest.fn(),
        restarting: jest.fn()
      } as unknown as ApexLSPStatusBarItem;

      // Setup telemetry service mock
      mockTelemetryService = new MockTelemetryService();
      (getTelemetryService as jest.Mock).mockResolvedValue(mockTelemetryService);
      mockTelemetryService.sendEventData = jest.fn();

      // Mock VSCode workspace configuration
      const mockGetConfiguration = jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue('prompt')
      });
      (vscode.workspace.getConfiguration as jest.Mock) = mockGetConfiguration;

      // Reset the isRestarting flag
      (languageClientManager as any).isRestarting = false;

      // Setup client and status bar
      languageClientManager.setClientInstance(mockClient);
      languageClientManager.setStatusBarInstance(mockStatusBar);
    });

    afterEach(() => {
      setTimeoutSpy.mockRestore();
    });

    it('should show information message if already restarting', async () => {
      // Set isRestarting to true
      (languageClientManager as any).isRestarting = true;

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext);

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
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext);

      // Verify showQuickPick was called
      expect(vscode.window.showQuickPick).toHaveBeenCalled();

      // Verify no other actions were taken
      expect(mockClient.stop).not.toHaveBeenCalled();
      expect(mockStatusBar.restarting).not.toHaveBeenCalled();
    });

    it('should restart without cleaning DB when restart only option is selected', async () => {
      // Mock showQuickPick to return the restart only option
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce(
        nls.localize('apex_language_server_restart_dialog_restart_only')
      );

      // Mock removeApexDB
      const removeApexDBSpy = jest.spyOn(languageClientManager as any, 'removeApexDB');

      // Mock createLanguageClient to resolve immediately
      jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext);

      // Verify showQuickPick was called
      expect(vscode.window.showQuickPick).toHaveBeenCalled();

      // Verify client was stopped
      expect(mockClient.stop).toHaveBeenCalled();

      // Verify status bar was updated
      expect(mockStatusBar.restarting).toHaveBeenCalled();

      // Verify removeApexDB was not called
      expect(removeApexDBSpy).not.toHaveBeenCalled();

      // Verify setTimeout was called
      expect(setTimeoutSpy).toHaveBeenCalled();

      // Fast-forward timers and wait for promises to resolve
      jest.runAllTimers();
      await Promise.resolve();

      // Verify isRestarting was reset
      expect((languageClientManager as any).isRestarting).toBe(false);
    });

    it('should restart and clean DB when clean and restart option is selected', async () => {
      // Mock showQuickPick to return the clean and restart option
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce(
        nls.localize('apex_language_server_restart_dialog_clean_and_restart')
      );

      // Mock removeApexDB
      const removeApexDBSpy = jest.spyOn(languageClientManager as any, 'removeApexDB');

      // Mock createLanguageClient to resolve immediately
      jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext);

      // Verify showQuickPick was called
      expect(vscode.window.showQuickPick).toHaveBeenCalled();

      // Verify client was stopped
      expect(mockClient.stop).toHaveBeenCalled();

      // Verify status bar was updated
      expect(mockStatusBar.restarting).toHaveBeenCalled();

      // Verify removeApexDB was called
      expect(removeApexDBSpy).toHaveBeenCalled();

      // Verify setTimeout was called
      expect(setTimeoutSpy).toHaveBeenCalled();

      // Fast-forward timers and wait for promises to resolve
      jest.runAllTimers();
      await Promise.resolve();

      // Verify isRestarting was reset
      expect((languageClientManager as any).isRestarting).toBe(false);
    });

    it('should handle errors during client stop', async () => {
      // Mock showQuickPick to return the restart only option
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce(
        nls.localize('apex_language_server_restart_dialog_restart_only')
      );

      // Mock client.stop to throw an error
      const errorMessage = 'Test error';
      (mockClient.stop as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      // Mock createLanguageClient to resolve immediately
      jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext);

      // Verify showWarningMessage was called with the correct message
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        `${nls.localize('apex_language_server_restart_dialog_restart_only')} - ${errorMessage}`
      );

      // Verify setTimeout was still called
      expect(setTimeoutSpy).toHaveBeenCalled();

      // Fast-forward timers and wait for promises to resolve
      jest.runAllTimers();
      await Promise.resolve();

      // Verify isRestarting was reset
      expect((languageClientManager as any).isRestarting).toBe(false);
    });

    it('should reset isRestarting flag if there is no client instance', async () => {
      // Set client instance to undefined
      languageClientManager.setClientInstance(undefined);

      // Mock showQuickPick to return the restart only option
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce(
        nls.localize('apex_language_server_restart_dialog_restart_only')
      );

      // Call the method
      await languageClientManager.restartLanguageServerAndClient(mockExtensionContext);

      // Verify isRestarting was reset
      expect((languageClientManager as any).isRestarting).toBe(false);
    });

    describe('Restart Behavior Setting', () => {
      it('should use prompt behavior by default', async () => {
        // Mock showQuickPick to return the restart only option
        (vscode.window.showQuickPick as jest.Mock).mockResolvedValueOnce(
          nls.localize('apex_language_server_restart_dialog_restart_only')
        );

        // Mock createLanguageClient to resolve immediately
        jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

        // Call the method
        await languageClientManager.restartLanguageServerAndClient(mockExtensionContext);

        // Verify showQuickPick was called
        expect(vscode.window.showQuickPick).toHaveBeenCalled();

        // Verify telemetry was sent
        expect(mockTelemetryService.sendEventData).toHaveBeenCalledWith('apexLSPRestart', {
          restartBehavior: 'prompt',
          selectedOption: 'restart'
        });
      });

      it('should use restart behavior when configured', async () => {
        // Mock getConfiguration to return 'restart' behavior
        const mockGetConfiguration = jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue('restart')
        });
        (vscode.workspace.getConfiguration as jest.Mock) = mockGetConfiguration;

        // Mock createLanguageClient to resolve immediately
        jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

        // Call the method
        await languageClientManager.restartLanguageServerAndClient(mockExtensionContext);

        // Verify showQuickPick was not called
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();

        // Verify telemetry was sent
        expect(mockTelemetryService.sendEventData).toHaveBeenCalledWith('apexLSPRestart', {
          restartBehavior: 'restart'
        });
      });

      it('should use reset behavior when configured', async () => {
        // Mock getConfiguration to return 'reset' behavior
        const mockGetConfiguration = jest.fn().mockReturnValue({
          get: jest.fn().mockReturnValue('reset')
        });
        (vscode.workspace.getConfiguration as jest.Mock) = mockGetConfiguration;

        // Mock createLanguageClient to resolve immediately
        jest.spyOn(languageClientManager, 'createLanguageClient').mockResolvedValueOnce();

        // Call the method
        await languageClientManager.restartLanguageServerAndClient(mockExtensionContext);

        // Verify showQuickPick was not called
        expect(vscode.window.showQuickPick).not.toHaveBeenCalled();

        // Verify telemetry was sent
        expect(mockTelemetryService.sendEventData).toHaveBeenCalledWith('apexLSPRestart', {
          restartBehavior: 'reset'
        });
      });
    });
  });
});
