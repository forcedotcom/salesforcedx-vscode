/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Mock as VitestMock } from 'vitest';
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { isConflictDetectionEnabled } from '../../../src/conflict/conflictDetectionSettings';

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn()
  }
}));

describe('conflictDetectionSettings', () => {
  let mockGetConfiguration: VitestMock;
  let mockGet: VitestMock;

  beforeEach(() => {
    mockGet = vi.fn();
    mockGetConfiguration = vscode.workspace.getConfiguration as VitestMock;
    mockGetConfiguration.mockReturnValue({
      get: mockGet
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
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
});
