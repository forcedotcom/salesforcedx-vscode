/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { fetchFromApi, fetchFromLs, getApexTests } from '../../../src/languageUtils';
import { languageClientManager } from '../../../src/languageUtils/languageClientManager';
import { setTelemetryService } from '../../../src/telemetry/telemetry';
import { discoverTests } from '../../../src/testDiscovery/testDiscovery';
import { ApexTestMethod } from '../../../src/views/lspConverter';
import { MockTelemetryService } from '../telemetry/mockTelemetryService';

// Mock dependencies
jest.mock('../../../src/languageUtils/languageClientManager');
jest.mock('../../../src/testDiscovery/testDiscovery');

describe('languageUtils/index', () => {
  let mockTelemetryService: MockTelemetryService;
  let sendEventDataSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTelemetryService = new MockTelemetryService();
    setTelemetryService(mockTelemetryService);
    sendEventDataSpy = jest.spyOn(mockTelemetryService, 'sendEventData');
  });

  describe('fetchFromLs', () => {
    it('should fetch tests from language server and emit telemetry', async () => {
      // Arrange
      const mockTests: ApexTestMethod[] = [
        {
          methodName: 'testMethod1',
          definingType: 'TestClass1',
          location: {} as vscode.Location
        },
        {
          methodName: 'testMethod2',
          definingType: 'TestClass1',
          location: {} as vscode.Location
        },
        {
          methodName: 'testMethod3',
          definingType: 'TestClass2',
          location: {} as vscode.Location
        }
      ];

      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue(mockTests);

      // Act
      const result = await fetchFromLs();

      // Assert
      expect(result.tests).toEqual(mockTests);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(languageClientManager.getApexTests).toHaveBeenCalledTimes(1);

      // Verify telemetry events
      expect(sendEventDataSpy).toHaveBeenCalledWith('apexTestDiscoveryStart', { source: 'ls' });
      expect(sendEventDataSpy).toHaveBeenCalledWith(
        'apexTestDiscoveryEnd',
        { source: 'ls' },
        expect.objectContaining({
          durationMs: expect.any(Number),
          numClasses: 2, // TestClass1 and TestClass2
          numMethods: 3
        })
      );
    });

    it('should handle empty test results', async () => {
      // Arrange
      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await fetchFromLs();

      // Assert
      expect(result.tests).toEqual([]);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(sendEventDataSpy).toHaveBeenCalledWith(
        'apexTestDiscoveryEnd',
        { source: 'ls' },
        expect.objectContaining({
          numClasses: 0,
          numMethods: 0
        })
      );
    });

    it('should propagate errors from language server', async () => {
      // Arrange
      const error = new Error('Language server error');
      (languageClientManager.getApexTests as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(fetchFromLs()).rejects.toThrow('Language server error');
    });
  });

  describe('fetchFromApi', () => {
    beforeEach(() => {
      // Mock workspace.findFiles to return empty by default
      (vscode.workspace.findFiles as unknown) = jest.fn().mockResolvedValue([]);
    });

    it('should fetch tests from Tooling API and measure duration', async () => {
      // Arrange
      const mockApiResult = {
        classes: [
          {
            id: '01p000000000001',
            name: 'TestClass1',
            namespacePrefix: '',
            testMethods: [{ name: 'testMethod1' }, { name: 'testMethod2' }]
          }
        ]
      };

      (discoverTests as jest.Mock).mockResolvedValue(mockApiResult);

      // Mock workspace.findFiles to return a matching URI
      const mockUri = vscode.Uri.file('/workspace/force-app/main/default/classes/TestClass1.cls');
      (vscode.workspace.findFiles as unknown) = jest.fn().mockResolvedValue([mockUri]);

      // Act
      const result = await fetchFromApi();

      // Assert
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(discoverTests).toHaveBeenCalledTimes(1);
      // We know convertApiToApexTestMethods was called, which validates the conversion
      expect(result.tests).toBeDefined();
    });

    it('should handle empty API results', async () => {
      // Arrange
      (discoverTests as jest.Mock).mockResolvedValue({ classes: [] });

      // Act
      const result = await fetchFromApi();

      // Assert
      expect(result.tests).toEqual([]);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should propagate errors from Tooling API', async () => {
      // Arrange
      const error = new Error('Tooling API error');
      (discoverTests as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(fetchFromApi()).rejects.toThrow('Tooling API error');
    });
  });

  describe('getApexTests', () => {
    beforeEach(() => {
      // Mock workspace.findFiles to return empty by default
      (vscode.workspace.findFiles as unknown) = jest.fn().mockResolvedValue([]);
    });

    it('should use Language Server when source is "ls"', async () => {
      // Arrange
      const mockTests: ApexTestMethod[] = [
        {
          methodName: 'testMethod1',
          definingType: 'TestClass1',
          location: {} as vscode.Location
        }
      ];

      const mockGetConfig = jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue('ls')
      });
      (vscode.workspace.getConfiguration as unknown) = mockGetConfig;
      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue(mockTests);

      // Act
      const result = await getApexTests();

      // Assert
      expect(result).toEqual(mockTests);
      expect(languageClientManager.getApexTests).toHaveBeenCalledTimes(1);
      expect(discoverTests).not.toHaveBeenCalled();
    });

    it('should use Tooling API when source is "api"', async () => {
      // Arrange
      const mockApiResult = {
        classes: [
          {
            id: '01p000000000001',
            name: 'TestClass1',
            namespacePrefix: '',
            testMethods: [{ name: 'testMethod1' }]
          }
        ]
      };

      const mockUri = vscode.Uri.file('/workspace/force-app/main/default/classes/TestClass1.cls');

      const mockGetConfig = jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue('api')
      });
      (vscode.workspace.getConfiguration as unknown) = mockGetConfig;
      (discoverTests as jest.Mock).mockResolvedValue(mockApiResult);
      (vscode.workspace.findFiles as unknown) = jest.fn().mockResolvedValue([mockUri]);

      // Act
      const result = await getApexTests();

      // Assert
      expect(result).toBeDefined();
      expect(discoverTests).toHaveBeenCalledTimes(1);
      expect(languageClientManager.getApexTests).not.toHaveBeenCalled();
    });

    it('should default to Language Server when source is not specified', async () => {
      // Arrange
      const mockTests: ApexTestMethod[] = [
        {
          methodName: 'testMethod1',
          definingType: 'TestClass1',
          location: {} as vscode.Location
        }
      ];

      // Mock config.get to simulate returning the default value
      const getFunc = jest.fn().mockImplementation((key: string, defaultValue?: string) => defaultValue ?? 'ls');
      const mockGetConfig = jest.fn().mockReturnValue({
        get: getFunc
      });
      (vscode.workspace.getConfiguration as unknown) = mockGetConfig;
      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue(mockTests);

      // Act
      const result = await getApexTests();

      // Assert
      expect(result).toEqual(mockTests);
      expect(languageClientManager.getApexTests).toHaveBeenCalledTimes(1);
      expect(discoverTests).not.toHaveBeenCalled();
      // Verify the config was called correctly with the right key
      expect(getFunc).toHaveBeenCalledWith('testing.discoverySource', 'ls');
    });

    it('should read configuration from correct workspace setting', async () => {
      // Arrange
      const mockGetConfig = jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue('api')
      });
      (vscode.workspace.getConfiguration as unknown) = mockGetConfig;
      (vscode.workspace.findFiles as unknown) = jest.fn().mockResolvedValue([]);

      (discoverTests as jest.Mock).mockResolvedValue({ classes: [] });

      // Act
      await getApexTests();

      // Assert
      expect(mockGetConfig).toHaveBeenCalledWith('salesforcedx-vscode-apex');
    });
  });
});
