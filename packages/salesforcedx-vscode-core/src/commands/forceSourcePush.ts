import * as vscode from 'vscode';
import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { channelService } from '../channels';
import { notificationService } from '../notifications';
import { CancellableStatusBar, taskViewService } from '../statuses';

export function forceSourcePush() {
  const cancellationTokenSource = new vscode.CancellationTokenSource();
  const cancellationToken = cancellationTokenSource.token;

  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder().withArg('force:source:push').build(),
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
