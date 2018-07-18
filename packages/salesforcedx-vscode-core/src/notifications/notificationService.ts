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
import { STATUS_BAR_MSG_TIMEOUT_MS } from '../constants';
import { nls } from '../messages';
import { sfdxCoreSettings } from '../settings';

/**
 * A centralized location for all notification functionalities.
 */
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

  // Prefer these over directly calling the vscode.show* functions
  // We can expand these to be facades that gather analytics of failures.

  public showErrorMessage(
    message: string,
    ...items: string[]
  ): Thenable<string | undefined> {
    return vscode.window.showErrorMessage(message, ...items);
  }

  public showInformationMessage(
    message: string,
    ...items: string[]
  ): Thenable<string | undefined> {
    return vscode.window.showInformationMessage(message, ...items);
  }

  public showWarningMessage(
    message: string,
    ...items: string[]
  ): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(message, ...items);
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
      if (data !== undefined && data.toString() === '0') {
        await this.showSuccessfulExecution(executionName);
      } else {
        this.showFailedExecution(executionName);
      }
    });

    if (cancellationToken) {
      cancellationToken.onCancellationRequested(() => {
        this.showCanceledExecution(executionName);
      });
    }
  }

  private showFailedExecution(executionName: string) {
    this.showErrorMessage(
      nls.localize('notification_unsuccessful_execution_text', executionName)
    );
    this.channel.show();
  }

  private showCanceledExecution(executionName: string) {
    this.showWarningMessage(
      nls.localize('notification_canceled_execution_text', executionName)
    );
    this.channel.show();
  }

  public async showSuccessfulExecution(executionName: string) {
    const message = nls.localize(
      'notification_successful_execution_text',
      executionName
    );
    if (sfdxCoreSettings.getShowCLISuccessMsg()) {
      const showButtonText = nls.localize('notification_show_button_text');
      const showOnlyStatusBarButtonText = nls.localize(
        'notification_show_in_status_bar_button_text'
      );
      const selection = await this.showInformationMessage(
        message,
        showButtonText,
        showOnlyStatusBarButtonText
      );
      if (selection && selection === showButtonText) {
        this.channel.show();
      }
      if (selection && selection === showOnlyStatusBarButtonText) {
        await sfdxCoreSettings.updateShowCLISuccessMsg(false);
      }
    } else {
      vscode.window.setStatusBarMessage(message, STATUS_BAR_MSG_TIMEOUT_MS);
    }
  }

  public reportExecutionError(
    executionName: string,
    observable: Observable<Error | undefined>
  ) {
    observable.subscribe(async data => {
      this.showErrorMessage(
        nls.localize('notification_unsuccessful_execution_text', executionName)
      );
      this.channel.show();
    });
  }
}
