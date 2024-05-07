import { RefreshSObjectsExecutor } from '..';
import * as vscode from 'vscode';

export class CommandCompletionEvents implements vscode.Disposable {
  protected static instance: CommandCompletionEvents;

  public static getInstance(): CommandCompletionEvents {
    if (!CommandCompletionEvents.instance) {
      CommandCompletionEvents.instance = new CommandCompletionEvents();
    }
    return CommandCompletionEvents.instance;
  }

  public static onRefreshSObjectsCommandComplete(
    listener: (event: unknown) => unknown
  ) {
    RefreshSObjectsExecutor.onRefreshSObjectsCommandComplete(listener);
  }

  public dispose() {
    RefreshSObjectsExecutor.refreshSObjectsCommandCompleteEventEmitter.dispose();
  }
}
