import * as vscode from 'vscode';
import { nls } from '../../src/messages';

import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';

export class ProgressNotification {
  public static async show(
    execution: CommandExecution,
    token: vscode.CancellationTokenSource
  ) {
    await vscode.window.withProgress(
      {
        title: nls.localize('progress_notification_text', execution.command),
        location: vscode.ProgressLocation.Notification,
        cancellable: true
      },
      async (progress, cancellationToken) => {
        return new Promise(resolve => {
          cancellationToken.onCancellationRequested(() => {
            token.cancel();
          });

          execution.processExitSubject.subscribe(data => {
            return resolve();
          });

          execution.processErrorSubject.subscribe(data => {
            return resolve();
          });
        });
      }
    );
  }
}
