/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Observable } from 'rxjs/Observable';
import * as vscode from 'vscode';
import { CommandExecution } from '../cli';
import { SFDX_CORE_CONFIGURATION_NAME } from '../constants';
import { nls } from '../messages';
import { ChannelService } from './index';

export const STATUS_BAR_MSG_TIMEOUT_MS = 5000;

/**
 * A centralized location for all notification functionalities.
 */
export class NotificationService {
  private static instance: NotificationService;

  public static getInstance() {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Prefer these over directly calling the vscode.show* functions
  // We can expand these to be facades that gather analytics of failures.

  public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showErrorMessage(message, ...items);
  }

  public showInformationMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showInformationMessage(message, ...items);
  }

  public showWarningMessage(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(message, ...items);
  }

  public showWarningModal(message: string, ...items: string[]): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(message, { modal: true }, ...items);
  }

  public reportCommandExecutionStatus(
    execution: CommandExecution,
    channelService: ChannelService | undefined,
    cancellationToken?: vscode.CancellationToken
  ) {
    // https://stackoverflow.com/questions/38168581/observablet-is-not-a-class-derived-from-observablet
    this.reportExecutionStatus(
      execution.command.toString(),
      channelService,
      execution.processExitSubject as any as Observable<number | undefined>,
      cancellationToken
    );
    this.reportExecutionError(
      execution.command.toString(),
      execution.processErrorSubject as any as Observable<Error | undefined>
    );
  }

  public reportExecutionStatus(
    executionName: string,
    channelService: ChannelService | undefined,
    observable: Observable<number | undefined>,
    cancellationToken?: vscode.CancellationToken
  ) {
    observable.subscribe(async data => {
      if (data !== undefined && String(data) === '0') {
        await this.showSuccessfulExecution(executionName, channelService);
      } else if (data !== null) {
        this.showFailedExecution(executionName);
      }
    });
    if (cancellationToken) {
      cancellationToken.onCancellationRequested(() => {
        this.showCanceledExecution(executionName);
      });
    }
  }

  public showFailedExecution(executionName: string) {
    this.showErrorMessage(nls.localize('notification_unsuccessful_execution_text', executionName));
  }

  public showCanceledExecution(executionName: string) {
    this.showWarningMessage(nls.localize('notification_canceled_execution_text', executionName));
  }

  public async showSuccessfulExecution(executionName: string, channelService: ChannelService | undefined) {
    const message = nls.localize('notification_successful_execution_text', executionName);
    const coreConfigurationName = vscode.workspace.getConfiguration(SFDX_CORE_CONFIGURATION_NAME);
    const showCLISuccessMsg = coreConfigurationName.get<boolean>('show-cli-success-msg', true);
    if (showCLISuccessMsg) {
      const showButtonText = nls.localize('notification_show_button_text');
      const showOnlyStatusBarButtonText = nls.localize('notification_show_in_status_bar_button_text');
      const selection = await this.showInformationMessage(message, showButtonText, showOnlyStatusBarButtonText);
      if (selection) {
        if (selection === showButtonText && channelService) {
          channelService.showChannelOutput();
        } else if (selection === showOnlyStatusBarButtonText) {
          await coreConfigurationName.update('show-cli-success-msg', false);
        }
      }
    } else {
      vscode.window.setStatusBarMessage(message, STATUS_BAR_MSG_TIMEOUT_MS);
    }
  }

  public reportExecutionError(executionName: string, observable: Observable<Error | undefined>) {
    observable.subscribe(async () => {
      this.showErrorMessage(nls.localize('notification_unsuccessful_execution_text', executionName));
    });
  }
}
