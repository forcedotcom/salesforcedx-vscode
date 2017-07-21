/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { DEFAULT_SFDX_CHANNEL } from '../channels';
import { nls } from '../messages';

export class NotificationService {
  private readonly channel: vscode.OutputChannel;
  private static instance: NotificationService;

  public constructor(channel?: vscode.OutputChannel) {
    this.channel = channel || DEFAULT_SFDX_CHANNEL;
  }

  public static getInstance(channel?: vscode.OutputChannel) {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService(channel);
    }
    return NotificationService.instance;
  }

  public reportCommandExecutionStatus(
    execution: CommandExecution,
    cancellationToken?: vscode.CancellationToken
  ) {
    // https://stackoverflow.com/questions/38168581/observablet-is-not-a-class-derived-from-observablet
    this.reportExecutionStatus(
      execution.command.toString(),
      (execution.processExitSubject as any) as Observable<number | undefined>,
      cancellationToken
    );
    this.reportExecutionError(
      execution.command.toString(),
      (execution.processErrorSubject as any) as Observable<Error | undefined>
    );
  }

  public reportExecutionStatus(
    executionName: string,
    observable: Observable<number | undefined>,
    cancellationToken?: vscode.CancellationToken
  ) {
    observable.subscribe(async data => {
      if (data != undefined && data.toString() === '0') {
        const showButtonText = nls.localize('notification_show_button_text');
        const selection = await vscode.window.showInformationMessage(
          nls.localize('notification_successful_execution_text', executionName),
          showButtonText
        );
        if (selection && selection === showButtonText) {
          this.channel.show();
        }
      } else {
        if (cancellationToken && cancellationToken.isCancellationRequested) {
          vscode.window.showWarningMessage(
            nls.localize('notification_canceled_execution_text', executionName)
          );
          this.channel.show();
        } else {
          vscode.window.showErrorMessage(
            nls.localize(
              'notification_unsuccessful_execution_text',
              executionName
            )
          );
          this.channel.show();
        }
      }
    });
  }

  public reportExecutionError(
    executionName: string,
    observable: Observable<Error | undefined>
  ) {
    observable.subscribe(async data => {
      vscode.window.showErrorMessage(
        nls.localize('notification_unsuccessful_execution_text', executionName)
      );
      this.channel.show();
    });
  }
}
