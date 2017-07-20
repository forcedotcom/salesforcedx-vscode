import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';

export function forceSourceStatus() {
  const cancellationTokenSource = new vscode.CancellationTokenSource();
  const cancellationToken = cancellationTokenSource.token;

  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withDescription(nls.localize('force_source_status_text'))
      .withArg('force:source:status')
      .build(),
    { cwd: vscode.workspace.rootPath }
  ).execute(cancellationToken);

  channelService.streamCommandOutput(execution);
  notificationService.reportCommandExecutionStatus(
    execution,
    cancellationToken
  );
  CancellableStatusBar.show(execution, cancellationTokenSource);
  taskViewService.addCommandExecution(execution, cancellationTokenSource);
}
