/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import * as path from 'node:path';
import { SourceTrackingProvider } from '../../../src/providers/sourceTrackingProvider';

describe('SourceTrackingProvider', () => {
  let provider: SourceTrackingProvider;
  let mockConnection: Connection;

  beforeEach(() => {
    provider = SourceTrackingProvider.getInstance();
    mockConnection = {
      getUsername: jest.fn().mockReturnValue('test@example.com')
    } as any;
  });

  afterEach(() => {
    // Clear the singleton instance for clean tests
    (SourceTrackingProvider as any).instance = undefined;
  });

  describe('clearSourceTracker', () => {
    it('should clear the source tracker for a valid connection', () => {
      const projectPath = path.join('test', 'project', 'path');
      const key = `${projectPath}test@example.com`;

      // Mock the internal sourceTrackers map
      (provider as any).sourceTrackers = new Map();
      (provider as any).sourceTrackers.set(key, { some: 'tracker' });

      expect((provider as any).sourceTrackers.has(key)).toBe(true);

      provider.clearSourceTracker(projectPath, mockConnection);

      expect((provider as any).sourceTrackers.has(key)).toBe(false);
    });
  });
});
