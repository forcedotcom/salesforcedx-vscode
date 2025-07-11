/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConnectionService, ConnectionServiceLive, ProjectService, ProjectServiceLive } from '../../../src/core';

describe('Effect Services', () => {
  describe('ConnectionService', () => {
    it('should be defined as a service tag', () => {
      expect(ConnectionService).toBeDefined();
      expect(typeof ConnectionService).toBe('object');
    });

    it('should have a live implementation', () => {
      expect(ConnectionServiceLive).toBeDefined();
    });
  });

  describe('ProjectService', () => {
    it('should be defined as a service tag', () => {
      expect(ProjectService).toBeDefined();
      expect(typeof ProjectService).toBe('object');
    });

    it('should have a live implementation', () => {
      expect(ProjectServiceLive).toBeDefined();
    });
  });
});
