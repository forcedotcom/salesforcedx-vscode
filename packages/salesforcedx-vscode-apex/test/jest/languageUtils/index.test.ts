/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

// Provide a runtime whose runPromise just runs the effect with the default runtime (spans no-op).
jest.mock('../../../src/services/runtime', () => ({
  getRuntime: () => ({ runPromise: (eff: any) => require('effect/Effect').runPromise(eff) })
}));

import { fetchFromLs, getApexTests } from '../../../src/languageUtils';
import { languageClientManager } from '../../../src/languageUtils/languageClientManager';
import { ApexTestMethod } from '../../../src/views/lspConverter';

// Mock dependencies
jest.mock('../../../src/languageUtils/languageClientManager');

describe('languageUtils/index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchFromLs', () => {
    it('should fetch tests from language server and return timing/counts', async () => {
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
    });

    it('should handle empty test results', async () => {
      // Arrange
      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await fetchFromLs();

      // Assert
      expect(result.tests).toEqual([]);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should propagate errors from language server', async () => {
      // Arrange
      const error = new Error('Language server error');
      (languageClientManager.getApexTests as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(fetchFromLs()).rejects.toThrow('Language server error');
    });
  });

  describe('getApexTests', () => {
    it('should fetch tests from Language Server', async () => {
      // Arrange
      const mockTests: ApexTestMethod[] = [
        {
          methodName: 'testMethod1',
          definingType: 'TestClass1',
          location: {} as vscode.Location
        }
      ];

      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue(mockTests);

      // Act
      const result = await getApexTests();

      // Assert
      expect(result).toEqual(mockTests);
      expect(languageClientManager.getApexTests).toHaveBeenCalledTimes(1);
    });

    it('should handle empty test results', async () => {
      // Arrange
      (languageClientManager.getApexTests as jest.Mock).mockResolvedValue([]);

      // Act
      const result = await getApexTests();

      // Assert
      expect(result).toEqual([]);
    });

    it('should propagate errors from language server', async () => {
      // Arrange
      const error = new Error('Language server error');
      (languageClientManager.getApexTests as jest.Mock).mockRejectedValue(error);

      // Act & Assert
      await expect(getApexTests()).rejects.toThrow('Language server error');
    });
  });
});
