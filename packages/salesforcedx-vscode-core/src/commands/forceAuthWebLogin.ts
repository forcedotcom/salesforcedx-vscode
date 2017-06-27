import * as vscode from 'vscode';
import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { streamCommandOutput } from '../channels';
import { reportExecutionStatus } from '../notifications';
import { CancellableStatusBar } from '../statuses';

export function forceAuthWebLogin() {
  const cancellationTokenSource = new vscode.CancellationTokenSource();
  const cancellationToken = cancellationTokenSource.token;

  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:auth:web:login')
      .withArg('--setdefaultdevhubusername')
      .build(),
    { cwd: vscode.workspace.rootPath }
  ).execute(cancellationTokenSource.token);

  streamCommandOutput(execution);
  reportExecutionStatus(execution, cancellationToken);
  CancellableStatusBar.show(execution, cancellationTokenSource);
}
