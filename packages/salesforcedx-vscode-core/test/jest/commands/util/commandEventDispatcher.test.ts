/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommandEventDispatcher } from '../../../../src/commands/util/commandEventDispatcher';

describe('CommandEventDispatcher', () => {
  describe('getInstance', () => {
    it('should return the instance of CommandEventDispatcher', () => {
      const instance = CommandEventDispatcher.getInstance();
      expect(instance).toBeDefined();
    });

    it('should return the same instance of CommandEventDispatcher', () => {
      const instance1 = CommandEventDispatcher.getInstance();
      const instance2 = CommandEventDispatcher.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('onRefreshSObjectsCommandCompletion', () => {
    it('should subscribe to the completion event without throwing', () => {
      const dispatcher = CommandEventDispatcher.getInstance();
      expect(() => dispatcher.onRefreshSObjectsCommandCompletion(() => {})).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should not throw when disposed', () => {
      const dispatcher = CommandEventDispatcher.getInstance();
      expect(() => dispatcher.dispose()).not.toThrow();
    });
  });
});
