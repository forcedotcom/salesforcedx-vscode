/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as child_process from 'child_process';
import * as vscode from 'vscode';
import { ApexLanguageClient } from '../../../src/apexLanguageClient';
import ApexLSPStatusBarItem from '../../../src/apexLspStatusBarItem';
import { UBER_JAR_NAME } from '../../../src/constants';
import { languageClientManager } from '../../../src/languageUtils';
import { ClientStatus } from '../../../src/languageUtils/languageClientManager';
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
});
