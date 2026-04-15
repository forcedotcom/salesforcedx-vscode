/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getConflictMessagesFor, assertConflictLogName } from '../../../src/conflict/messages';

describe('messages', () => {
  describe('getConflictMessagesFor', () => {
    const aPath = 'a/path';
    it('should return --sourcepath command hint when deploy with source path is being run', () => {
      const bPath = 'b/path';
      const conflictMessages = getConflictMessagesFor('deploy_with_sourcepath');

      const commandHint = conflictMessages?.commandHint([aPath, bPath]);

      expect(commandHint).toContain('project:deploy:start --sourcepath');
      expect(commandHint).toContain(aPath);
      expect(commandHint).toContain(bPath);
    });

    it('should return --manifest command hint when deploy with manifest is being run', () => {
      const conflictMessages = getConflictMessagesFor('deploy_with_manifest');

      const commandHint = conflictMessages?.commandHint(aPath);

      expect(commandHint).toContain('project:deploy:start --manifest');
      expect(commandHint).toContain(aPath);
    });

    // Test removed: Function now uses union types to prevent invalid log names at compile time
  });

  describe('assertConflictLogName', () => {
    it('should return valid log name when provided with valid input', () => {
      expect(assertConflictLogName('deploy_with_sourcepath')).toBe('deploy_with_sourcepath');
      expect(assertConflictLogName('project_retrieve_start_default_scratch_org')).toBe(
        'project_retrieve_start_default_scratch_org'
      );
    });

    it('should throw error when provided with invalid log name', () => {
      expect(() => assertConflictLogName('invalid_log_name')).toThrow('Invalid conflict log name: invalid_log_name');
      expect(() => assertConflictLogName('')).toThrow('Invalid conflict log name: ');
    });
  });
});
