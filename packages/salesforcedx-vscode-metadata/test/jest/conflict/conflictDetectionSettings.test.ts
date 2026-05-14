/*
 * Copyright (c) 2025, salesforce.com, inc.
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
      mockGet.mockReturnValue(false);

      const result = await Effect.runPromise(isConflictDetectionEnabled());

      expect(result).toBe(true);
      expect(mockGetConfiguration).toHaveBeenCalledWith('salesforcedx-vscode-metadata');
      expect(mockGet).toHaveBeenCalledWith('sourceTracking.disableConflictDetection', false);
    });

    it('should return false when setting is true (conflict detection disabled)', async () => {
      mockGet.mockReturnValue(true);

      const result = await Effect.runPromise(isConflictDetectionEnabled());

      expect(result).toBe(false);
      expect(mockGetConfiguration).toHaveBeenCalledWith('salesforcedx-vscode-metadata');
      expect(mockGet).toHaveBeenCalledWith('sourceTracking.disableConflictDetection', false);
    });

    it('should return true when setting is undefined (default behavior)', async () => {
      mockGet.mockReturnValue(undefined);

      const result = await Effect.runPromise(isConflictDetectionEnabled());

      expect(result).toBe(true);
    });
  });

  describe('isConflictDetectionEnabledSync', () => {
    it('should return true when setting is false (conflict detection enabled by default)', () => {
      mockGet.mockReturnValue(false);

      const result = isConflictDetectionEnabledSync();

      expect(result).toBe(true);
      expect(mockGetConfiguration).toHaveBeenCalledWith('salesforcedx-vscode-metadata');
      expect(mockGet).toHaveBeenCalledWith('sourceTracking.disableConflictDetection', false);
    });

    it('should return false when setting is true (conflict detection disabled)', () => {
      mockGet.mockReturnValue(true);

      const result = isConflictDetectionEnabledSync();

      expect(result).toBe(false);
      expect(mockGetConfiguration).toHaveBeenCalledWith('salesforcedx-vscode-metadata');
      expect(mockGet).toHaveBeenCalledWith('sourceTracking.disableConflictDetection', false);
    });

    it('should return true when setting is undefined (default behavior)', () => {
      mockGet.mockReturnValue(undefined);

      const result = isConflictDetectionEnabledSync();

      expect(result).toBe(true);
    });
  });
});
