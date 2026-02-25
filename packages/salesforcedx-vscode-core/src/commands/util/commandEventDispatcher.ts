/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

const refreshSObjectsCommandCompletionEventEmitter = new vscode.EventEmitter<unknown>();

export class CommandEventDispatcher implements vscode.Disposable {
  protected static instance: CommandEventDispatcher;

  public static getInstance(): CommandEventDispatcher {
    if (!CommandEventDispatcher.instance) {
      CommandEventDispatcher.instance = new CommandEventDispatcher();
    }
    return CommandEventDispatcher.instance;
  }

  public onRefreshSObjectsCommandCompletion(listener: (event: unknown) => unknown): vscode.Disposable {
    return refreshSObjectsCommandCompletionEventEmitter.event(listener);
  }

  public dispose() {
    refreshSObjectsCommandCompletionEventEmitter.dispose();
  }
}

/**
 * Command registered in core that metadata's refresh command calls on completion.
 * Fires the refreshSObjectsCommandCompletion event for any registered listeners.
 */
export const registerSObjectRefreshCompleteCommand = (): vscode.Disposable =>
  vscode.commands.registerCommand('sf.internal.sobjectrefresh.complete', (event: unknown) => {
    refreshSObjectsCommandCompletionEventEmitter.fire(event);
  });
