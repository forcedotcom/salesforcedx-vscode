/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import {
  isConflictDetectionEnabled,
  isConflictDetectionEnabledSync
} from '../../../src/conflict/conflictDetectionSettings';

jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn()
  }
}));

describe('conflictDetectionSettings', () => {
  let mockGetConfiguration: jest.Mock;
  let mockGet: jest.Mock;

  beforeEach(() => {
    mockGet = jest.fn();
    mockGetConfiguration = vscode.workspace.getConfiguration as jest.Mock;
    mockGetConfiguration.mockReturnValue({
      get: mockGet
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isConflictDetectionEnabled (Effect version)', () => {
    it('should return true when setting is false (conflict detection enabled by default)', async () => {
      mockGet.mockReturnValue(true);

      const result = await Effect.runPromise(isConflictDetectionEnabled());

      expect(result).toBe(true);
      expect(mockGetConfiguration).toHaveBeenCalledWith('salesforcedx-vscode-metadata');
      expect(mockGet).toHaveBeenCalledWith('sourceTracking.enableConflictDetection', true);
    });

    it('should return false when setting is false (conflict detection disabled)', async () => {
      mockGet.mockReturnValue(false);

      const result = await Effect.runPromise(isConflictDetectionEnabled());

      expect(result).toBe(false);
      expect(mockGetConfiguration).toHaveBeenCalledWith('salesforcedx-vscode-metadata');
      expect(mockGet).toHaveBeenCalledWith('sourceTracking.enableConflictDetection', true);
    });

    it('should return true when setting is undefined (default behavior)', async () => {
      // When setting is not set, vscode returns the default value (true)
      mockGet.mockReturnValue(true);

      const result = await Effect.runPromise(isConflictDetectionEnabled());

      expect(result).toBe(true);
    });
  });

  describe('isConflictDetectionEnabledSync', () => {
    it('should return true when setting is true (conflict detection enabled by default)', () => {
      mockGet.mockReturnValue(true);

      const result = isConflictDetectionEnabledSync();

      expect(result).toBe(true);
      expect(mockGetConfiguration).toHaveBeenCalledWith('salesforcedx-vscode-metadata');
      expect(mockGet).toHaveBeenCalledWith('sourceTracking.enableConflictDetection', true);
    });

    it('should return false when setting is false (conflict detection disabled)', () => {
      mockGet.mockReturnValue(false);

      const result = isConflictDetectionEnabledSync();

      expect(result).toBe(false);
      expect(mockGetConfiguration).toHaveBeenCalledWith('salesforcedx-vscode-metadata');
      expect(mockGet).toHaveBeenCalledWith('sourceTracking.enableConflictDetection', true);
    });

    it('should return true when setting is undefined (default behavior)', () => {
      // When setting is not set, vscode returns the default value (true)
      mockGet.mockReturnValue(true);

      const result = isConflictDetectionEnabledSync();

      expect(result).toBe(true);
    });
  });
});
