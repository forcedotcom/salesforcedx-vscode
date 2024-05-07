/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { RefreshSObjectsExecutor } from '..';

export class CommandCompletionEvents implements vscode.Disposable {
  protected static instance: CommandCompletionEvents;

  public static getInstance(): CommandCompletionEvents {
    if (!CommandCompletionEvents.instance) {
      CommandCompletionEvents.instance = new CommandCompletionEvents();
    }
    return CommandCompletionEvents.instance;
  }

  public onRefreshSObjectsCommandComplete(
    listener: (event: unknown) => unknown
  ) {
    RefreshSObjectsExecutor.onRefreshSObjectsCommandCompletion(listener);
  }

  public dispose() {
    RefreshSObjectsExecutor.refreshSObjectsCommandCompletionEventEmitter.dispose();
  }
}
