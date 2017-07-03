import * as vscode from 'vscode';
import * as path from 'path';
import {
  CliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { channelService } from '../channels';
import { notificationService } from '../notifications';
import { CancellableStatusBar } from '../statuses';

export function forceOrgCreate() {
  vscode.workspace.findFiles('config/*.json', '').then(files => {
    const fileItems: vscode.QuickPickItem[] = files.map(file => {
      return {
        label: path.basename(file.toString()),
        description: file.fsPath
      };
    });
    vscode.window.showQuickPick(fileItems).then(selection => {
      if (selection) {
        const cancellationTokenSource = new vscode.CancellationTokenSource();
        const cancellationToken = cancellationTokenSource.token;

        const rootPath = vscode.workspace.rootPath!;
        const selectionPath = path.relative(
          rootPath,
          selection.description.toString()
        );
        const execution = new CliCommandExecutor(
          new SfdxCommandBuilder()
            .withArg('force:org:create')
            .withFlag('-f', `${selectionPath}`)
            .withArg('--setdefaultusername')
            .build(),
          { cwd: rootPath }
        ).execute(cancellationToken);

        channelService.streamCommandOutput(execution);
        notificationService.reportCommandExecutionStatus(
          execution,
          cancellationToken
        );
        CancellableStatusBar.show(execution, cancellationTokenSource);
      }
    });
  });
}
