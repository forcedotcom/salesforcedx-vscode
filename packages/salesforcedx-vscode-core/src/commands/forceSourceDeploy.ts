/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  ForceDeployResultParser
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
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
import { getRootWorkspacePath } from '../util';
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
    const workspacePath = getRootWorkspacePath() || '';
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
        const deployParser = new ForceDeployResultParser(stdOut);
        const errors = deployParser.getErrors();
        if (errors) {
          handleDiagnosticErrors(
            errors,
            workspacePath,
            execFilePathOrPaths,
            ForceSourceDeployExecutor.errorCollection
          );
        } else {
          ForceSourceDeployExecutor.errorCollection.clear();
        }
        this.outputResult(deployParser);
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
    const table = new Table();
    const errors = parser.getErrors();
    const successes = parser.getSuccesses();
    const deployedSource = successes
      ? successes.result.deployedSource
      : undefined;

    if (deployedSource) {
      const outputTable = table.createTable(
        (deployedSource as unknown) as Row[],
        [
          { key: 'state', label: nls.localize('table_header_state') },
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          { key: 'filePath', label: nls.localize('table_header_project_path') }
        ]
      );
      channelService.appendLine('=== Deployed Source');
      channelService.appendLine(outputTable);
    }

    if (errors) {
      const { name, message, result } = errors;
      if (result) {
        const outputTable = table.createTable(
          (errors.result as unknown) as Row[],
          [
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            },
            { key: 'error', label: nls.localize('table_header_errors') }
          ]
        );
        channelService.appendLine('=== Deploy Errors');
        channelService.appendLine(outputTable);
      } else if (name && message) {
        channelService.appendLine(`${name}: ${message}\n`);
      }
    }
  }
}
