/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { CommandExecution } from '../cli';
import { nls } from '../messages';

export class ProgressNotification {
  public static show(
    execution: CommandExecution,
    token: vscode.CancellationTokenSource,
    progressLocation?: vscode.ProgressLocation,
    progressReporter?: Observable<number>
  ) {
    return vscode.window.withProgress(
      {
        title: nls.localize('progress_notification_text', execution.command),
        location: progressLocation || vscode.ProgressLocation.Notification,
        cancellable: true
      },
      (progress, cancellationToken) =>
        new Promise(resolve => {
          cancellationToken.onCancellationRequested(() => {
            token.cancel();
            return resolve(undefined);
          });

          execution.processExitSubject.subscribe(() => resolve(undefined));

          execution.processErrorSubject.subscribe(() => resolve(undefined));

          if (progressReporter) {
            progressReporter.subscribe({
              next: increment => {
                progress.report({ increment });
              },
              complete: () => {
                progress.report({ increment: 100 });
                resolve(undefined);
              }
            });
          }
        })
    );
  }
}
