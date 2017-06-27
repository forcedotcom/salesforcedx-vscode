import * as vscode from 'vscode';
import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { streamCommandOutput } from '../channels';
import { reportExecutionStatus } from '../notifications';
import { CancellableStatusBar } from '../statuses';

export function forceOrgOpen() {
  const cancellationTokenSource = new vscode.CancellationTokenSource();
  const cancellationToken = cancellationTokenSource.token;

  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder().withArg('force:org:open').build(),
    { cwd: vscode.workspace.rootPath }
  ).execute(cancellationToken);

  streamCommandOutput(execution);
  reportExecutionStatus(execution, cancellationToken);
  CancellableStatusBar.show(execution, cancellationTokenSource);
}
