/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ProjectRetrieveStartExecutor } from '../../../../src/commands/projectRetrieveStart';
import { RetrieveExecutor } from '../../../../src/commands/retrieveExecutor';
import { PROJECT_RETRIEVE_START_LOG_NAME } from '../../../../src/constants';

describe('SfCommandletExecutor', () => {
  beforeEach(() => {
    // Setup any common mocks if needed
  });

  describe('ProjectRetrieveStartExecutor', () => {
    it('should extend RetrieveExecutor', () => {
      const executor = new ProjectRetrieveStartExecutor();
      expect(executor).toBeInstanceOf(RetrieveExecutor);
    });

    it('should have correct log name', () => {
      const executor = new ProjectRetrieveStartExecutor();
      expect((executor as any).logName).toBe(PROJECT_RETRIEVE_START_LOG_NAME);
    });

    it('should handle ignoreConflicts parameter', () => {
      const executor = new ProjectRetrieveStartExecutor(true);
      expect((executor as any).ignoreConflicts).toBe(true);
    });

    it('should have default ignoreConflicts value', () => {
      const executor = new ProjectRetrieveStartExecutor();
      expect((executor as any).ignoreConflicts).toBe(false);
    });

    it('should provide access to changed file paths', () => {
      const executor = new ProjectRetrieveStartExecutor();
      expect(executor.getChangedFilePaths()).toEqual([]);
    });
  });
});
