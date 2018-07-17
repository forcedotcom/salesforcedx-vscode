/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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
