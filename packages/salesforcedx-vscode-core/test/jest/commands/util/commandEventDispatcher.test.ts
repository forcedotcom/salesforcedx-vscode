/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { RefreshSObjectsExecutor } from '../../../../src/commands';
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
    const mockDisposable = new vscode.Disposable(() => {});

    beforeEach(() => {
      (RefreshSObjectsExecutor as any).onRefreshSObjectsCommandCompletion = jest.fn().mockReturnValue(mockDisposable);
    });

    it('should call refreshSObjectExecutor event and return the disposable', () => {
      const dispatcher = CommandEventDispatcher.getInstance();
      const listener = () => {};
      const disposable = dispatcher.onRefreshSObjectsCommandCompletion(listener);

      expect(disposable).toBe(mockDisposable);
      expect((RefreshSObjectsExecutor as any).onRefreshSObjectsCommandCompletion).toHaveBeenCalledWith(listener);
    });
  });

  describe('dispose', () => {
    beforeEach(() => {
      (RefreshSObjectsExecutor as any).refreshSObjectsCommandCompletionEventEmitter = { dispose: jest.fn() };
    });

    it('should dispose the refreshSObjectsCommandCompletionEventEmitter', () => {
      const dispatcher = CommandEventDispatcher.getInstance();
      dispatcher.dispose();

      expect((RefreshSObjectsExecutor as any).refreshSObjectsCommandCompletionEventEmitter.dispose).toHaveBeenCalled();
    });
  });
});
