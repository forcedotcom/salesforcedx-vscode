/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConnectionService } from '../../../src/core/connectionService';
import { ProjectService } from '../../../src/core/projectService';

describe('Effect Services', () => {
  describe('ConnectionService', () => {
    it('should be defined as a service class', () => {
      expect(ConnectionService).toBeDefined();
      expect(typeof ConnectionService).toBe('function');
    });

    it('should have a default implementation', () => {
      expect(ConnectionService.Default).toBeDefined();
    });
  });

  describe('ProjectService', () => {
    it('should be defined as a service class', () => {
      expect(ProjectService).toBeDefined();
      expect(typeof ProjectService).toBe('function');
    });

    it('should have a default implementation', () => {
      expect(ProjectService.Default).toBeDefined();
    });
  });
});
