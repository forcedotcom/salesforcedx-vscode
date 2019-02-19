/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  ForceDeployErrorParser,
  ForceSourceDeployErrorResult
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { TableColumn, TableRow } from '../channels/channelService';
import { handleDiagnosticErrors } from '../diagnostics';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { SfdxCommandletExecutor } from './commands';

interface DeployErrorRow {
  filePath: string;
  error: string;
}

export abstract class ForceSourceDeployExecutor extends SfdxCommandletExecutor<
  string
> {
  public static errorCollection = vscode.languages.createDiagnosticCollection(
    'deploy-errors'
  );

  public execute(response: ContinueResponse<string>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const workspacePath = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : '';
    const execFilePathOrPaths = response.data;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspacePath
    }).execute(cancellationToken);

    channelService.streamCommandStartStop(execution);
    channelService.showChannelOutput();

    let stdErr = '';
    execution.stderrSubject.subscribe(realData => {
      stdErr += realData.toString();
    });

    execution.processExitSubject.subscribe(async exitCode => {
      this.logMetric(execution.command.logName, startTime);
      if (exitCode !== 0) {
        try {
          const deployErrorParser = new ForceDeployErrorParser();
          const fileErrors = deployErrorParser.parse(stdErr);
          handleDiagnosticErrors(
            fileErrors,
            workspacePath,
            execFilePathOrPaths,
            ForceSourceDeployExecutor.errorCollection
          );
          this.outputErrors(fileErrors);
        } catch (e) {
          telemetryService.sendError(
            'Error while creating diagnostics for vscode problem view.'
          );
          console.error(
            'Error while creating diagnostics for vscode problem view.'
          );
        }
      } else {
        ForceSourceDeployExecutor.errorCollection.clear();
      }
    });

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  private outputErrors(errorResult: ForceSourceDeployErrorResult) {
    const cols: TableColumn[] = [
      { key: 'filePath', label: nls.localize('table_header_project_path')},
      { key: 'error', label: nls.localize('table_header_errors')}
    ];
    const rows: TableRow[] = errorResult.result.map(({filePath, error}) => ({
      filePath, error
    }));
    channelService.outputTable(rows, cols);
  }
}
