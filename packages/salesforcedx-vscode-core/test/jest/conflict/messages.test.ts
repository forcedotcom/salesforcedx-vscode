import { getConflictMessagesFor } from '../../../src/conflict/messages';

describe('messages', () => {
  describe('getConflictMessagesFor', () => {
    const aPath = 'a/path';
    it('should return --sourcepath command hint when deploy with source path is being run', () => {
      const bPath = 'b/path';
      const conflictMessages = getConflictMessagesFor(
        'force_source_deploy_with_sourcepath_beta'
      );

      const commandHint = conflictMessages?.commandHint([aPath, bPath]);

      expect(commandHint).toContain('force:source:deploy --sourcepath');
      expect(commandHint).toContain(aPath);
      expect(commandHint).toContain(bPath);
    });

    it('should return --manifest command hint when deploy with manifest is being run', () => {
      const conflictMessages = getConflictMessagesFor(
        'force_source_deploy_with_manifest_beta'
      );

      const commandHint = conflictMessages?.commandHint(aPath);

      expect(commandHint).toContain('force:source:deploy --manifest');
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
