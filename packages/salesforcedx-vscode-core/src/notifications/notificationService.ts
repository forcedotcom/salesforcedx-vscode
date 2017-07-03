import * as vscode from 'vscode';
import { Observable } from 'rxjs/Observable';
import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { DEFAULT_SFDX_CHANNEL } from '../channels';
import { localize } from '../messages';

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
      execution.command.command.toString(),
      (execution.processExitSubject as any) as Observable<
        number | string | null
      >,
      cancellationToken
    );
  }

  public reportExecutionStatus(
    executionName: string,
    observable: Observable<number | string | null>,
    cancellationToken?: vscode.CancellationToken
  ) {
    observable.subscribe(async data => {
      if (data !== null && data.toString() === '0') {
        const showButtonText = localize('notification_show_button_text');
        const selection = await vscode.window.showInformationMessage(
          localize('notification_successful_execution_message', executionName),
          showButtonText
        );
        if (selection && selection === showButtonText) {
          this.channel.show();
        }
      } else {
        if (cancellationToken && cancellationToken.isCancellationRequested) {
          vscode.window.showWarningMessage(
            localize('notification_canceled_execution_message', executionName)
          );
          this.channel.show();
        } else {
          vscode.window.showErrorMessage(
            localize(
              'notification_unsuccessful_execution_message',
              executionName
            )
          );
          this.channel.show();
        }
      }
    });
  }
}
