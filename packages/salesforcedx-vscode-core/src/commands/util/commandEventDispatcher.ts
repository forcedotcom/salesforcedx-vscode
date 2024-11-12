/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { RefreshSObjectsExecutor } from '..';

export class CommandEventDispatcher implements vscode.Disposable {
  protected static instance: CommandEventDispatcher;

  public static getInstance(): CommandEventDispatcher {
    if (!CommandEventDispatcher.instance) {
      CommandEventDispatcher.instance = new CommandEventDispatcher();
    }
    return CommandEventDispatcher.instance;
  }

  public onRefreshSObjectsCommandCompletion(listener: (event: unknown) => unknown): vscode.Disposable {
    return RefreshSObjectsExecutor.onRefreshSObjectsCommandCompletion(listener);
  }

  public dispose() {
    RefreshSObjectsExecutor.refreshSObjectsCommandCompletionEventEmitter.dispose();
  }
}
