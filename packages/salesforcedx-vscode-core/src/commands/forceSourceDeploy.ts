/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  ForceDeployResultParser,
  ForceSourceDeployErrorResult,
  ForceSourceDeploySuccessResult
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  Column,
  Row,
  Table
} from '@salesforce/salesforcedx-utils-vscode/out/src/output';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { handleDiagnosticErrors } from '../diagnostics';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { SfdxCommandletExecutor } from './commands';

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
      cwd: workspacePath,
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    channelService.streamCommandStartStop(execution);
    channelService.showChannelOutput();

    let stdOut = '';
    execution.stdoutSubject.subscribe(realData => {
      stdOut += realData.toString();
    });

    execution.processExitSubject.subscribe(async exitCode => {
      this.logMetric(execution.command.logName, startTime);
      try {
        const deployErrorParser = new ForceDeployResultParser(stdOut);
        if (exitCode !== 0) {
          const deployErrors = deployErrorParser.getErrors();
          if (deployErrors) {
            handleDiagnosticErrors(
              deployErrors,
              workspacePath,
              execFilePathOrPaths,
              ForceSourceDeployExecutor.errorCollection
            );
          }
        } else {
          ForceSourceDeployExecutor.errorCollection.clear();
        }
        this.outputResult(deployErrorParser);
      } catch (e) {
        telemetryService.sendError(
          'Error while creating diagnostics for vscode problem view.'
        );
        console.error(
          'Error while creating diagnostics for vscode problem view.'
        );
      }
    });

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  private outputResult(parser: ForceDeployResultParser) {
    let cols: Column[];
    let rows: Row[];
    const table = new Table();
    const errors = parser.getErrors();
    const successes = parser.getSuccesses();
    const deployedSource =
      (successes ? successes.result.deployedSource : undefined) ||
      (errors ? errors.partialSuccess : undefined);

    if (deployedSource) {
      cols = [
        { key: 'state', label: nls.localize('table_header_state') },
        { key: 'fullName', label: nls.localize('table_header_full_name') },
        { key: 'type', label: nls.localize('table_header_type') },
        { key: 'filePath', label: nls.localize('table_header_project_path') }
      ];
      rows = deployedSource.map(({ state, fullName, type, filePath }) => ({
        state,
        fullName,
        type,
        filePath
      }));
      channelService.appendLine('=== Deployed Source');
      channelService.appendLine(table.createTable(rows, cols));
    }

    if (errors) {
      cols = [
        { key: 'filePath', label: nls.localize('table_header_project_path') },
        { key: 'error', label: nls.localize('table_header_errors') }
      ];
      rows = errors.result.map(({ filePath, error }) => ({
        filePath,
        error
      }));
      channelService.appendLine('=== Deploy Errors');
      channelService.appendLine(table.createTable(rows, cols));
    }
  }
}
