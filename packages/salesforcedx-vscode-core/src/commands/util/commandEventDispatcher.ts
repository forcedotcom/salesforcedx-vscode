/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

const SF_SOBJECT_REFRESH_COMPLETE_COMMAND = 'sf.internal.sobjectrefresh.complete';

/**
 * Registers the sf.internal.sobjectrefresh.complete command and emits events to subscribers.
 * External consumers (e.g. Einstein GPT) subscribe via onRefreshSObjectsCommandCompletion.
 */
export class CommandEventDispatcher implements vscode.Disposable {
  protected static instance: CommandEventDispatcher;

  private readonly emitter = new vscode.EventEmitter<unknown>();
  private readonly commandDisposable: vscode.Disposable;

  private constructor() {
    this.commandDisposable = vscode.commands.registerCommand(
      SF_SOBJECT_REFRESH_COMPLETE_COMMAND,
      (event: unknown) => {
        this.emitter.fire(event);
      }
    );
  }

  public static getInstance(): CommandEventDispatcher {
    if (!CommandEventDispatcher.instance) {
      CommandEventDispatcher.instance = new CommandEventDispatcher();
    }
    return CommandEventDispatcher.instance;
  }

  public onRefreshSObjectsCommandCompletion(listener: (event: unknown) => unknown): vscode.Disposable {
    return this.emitter.event(listener);
  }

  public dispose(): void {
    this.emitter.dispose();
    this.commandDisposable.dispose();
  }
}
