import * as vscode from 'vscode';
import { CommandExecution } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { DEFAULT_SFDX_CHANNEL } from '../channels';

export function reportExecutionStatus(
  execution: CommandExecution,
  cancellationToken?: vscode.CancellationToken
) {
  execution.processExitSubject.subscribe(async data => {
    if (data !== null && data !== 'undefined' && data.toString() === '0') {
      const selection = await vscode.window.showInformationMessage(
        `Successfully executed ${execution.command}`,
        'Show'
      );
      if (selection && selection === 'Show') {
        DEFAULT_SFDX_CHANNEL.show();
      }
    } else {
      if (cancellationToken && cancellationToken.isCancellationRequested) {
        vscode.window.showWarningMessage(`${execution.command} canceled`);
        DEFAULT_SFDX_CHANNEL.show();
      } else {
        vscode.window.showErrorMessage(
          `Failed to execute ${execution.command}`
        );
        DEFAULT_SFDX_CHANNEL.show();
      }
    }
  });
}
