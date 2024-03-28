/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { getConflictMessagesFor } from '../../../src/conflict/messages';

describe('messages', () => {
  describe('getConflictMessagesFor', () => {
    const aPath = 'a/path';
    it('should return --sourcepath command hint when deploy with source path is being run', () => {
      const bPath = 'b/path';
      const conflictMessages = getConflictMessagesFor(
        'deploy_with_sourcepath_beta'
      );

      const commandHint = conflictMessages?.commandHint([aPath, bPath]);

      expect(commandHint).toContain('project:deploy:start --sourcepath');
      expect(commandHint).toContain(aPath);
      expect(commandHint).toContain(bPath);
    });

    it('should return --manifest command hint when deploy with manifest is being run', () => {
      const conflictMessages = getConflictMessagesFor(
        'deploy_with_manifest_beta'
      );

      const commandHint = conflictMessages?.commandHint(aPath);

      expect(commandHint).toContain('project:deploy:start --manifest');
      expect(commandHint).toContain(aPath);
    });

    it('should throw when called with an unrecognized command log name', () => {
      let thrownError;
      try {
        getConflictMessagesFor('Not-A-Command');
      } catch (error) {
        thrownError = error;
      }
      expect(thrownError).toBeDefined();
    });
  });
});
