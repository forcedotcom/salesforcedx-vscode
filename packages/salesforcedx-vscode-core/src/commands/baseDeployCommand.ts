/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecution,
  CliCommandExecutor,
  ContinueResponse,
  ForceDeployResultParser,
  Table,
  TelemetryBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { handleDiagnosticErrors } from '../diagnostics';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';
import { SfdxCommandletExecutor } from './util/sfdxCommandlet';

export enum DeployType {
  Deploy = 'deploy',
  Push = 'push'
}

export abstract class BaseDeployExecutor extends SfdxCommandletExecutor<
  string
> {
  public static errorCollection = vscode.languages.createDiagnosticCollection(
    'deploy-errors'
  );

  public execute(response: ContinueResponse<string>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const workspacePath = workspaceUtils.getRootWorkspacePath() || '';
    const execFilePathOrPaths =
      this.getDeployType() === DeployType.Deploy ? response.data : '';
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspacePath,
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);
    channelService.streamCommandStartStop(execution);

    let stdOut = '';
    execution.stdoutSubject.subscribe(realData => {
      stdOut += realData.toString();
    });

    execution.processExitSubject.subscribe(async exitCode => {
      await this.exitProcessHandlerDeploy(
        exitCode,
        stdOut,
        workspacePath,
        execFilePathOrPaths,
        execution,
        startTime,
        cancellationToken,
        cancellationTokenSource
      );
    });
  }

  protected async exitProcessHandlerDeploy(
    exitCode: number | undefined,
    stdOut: string,
    workspacePath: string,
    execFilePathOrPaths: string,
    execution: CliCommandExecution,
    startTime: [number, number],
    cancellationToken: vscode.CancellationToken | undefined,
    cancellationTokenSource: vscode.CancellationTokenSource
  ): Promise<void> {
    if (exitCode === 0 && this.getDeployType() === DeployType.Push) {
      const pushResult = this.parseOutput(stdOut);
      this.updateCache(pushResult);
    }

    const telemetry = new TelemetryBuilder();
    let success = false;
    try {
      BaseDeployExecutor.errorCollection.clear();
      if (stdOut) {
        const deployParser = new ForceDeployResultParser(stdOut);
        const errors = deployParser.getErrors();
        if (errors && !deployParser.hasConflicts()) {
          channelService.showChannelOutput();
          handleDiagnosticErrors(
            errors,
            workspacePath,
            execFilePathOrPaths,
            BaseDeployExecutor.errorCollection
          );
        } else {
          success = true;
        }
        this.outputResult(deployParser);
      }
    } catch (e) {
      BaseDeployExecutor.errorCollection.clear();
      if (e.name !== 'DeployParserFail') {
        e.message = 'Error while creating diagnostics for vscode problem view.';
      }
      telemetryService.sendException(e.name, e.message);
      console.error(e.message);
    }
    telemetry.addProperty('success', String(success));
    this.logMetric(
      execution.command.logName,
      startTime,
      telemetry.build().properties
    );
    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  protected abstract getDeployType(): DeployType;

  public outputResult(parser: ForceDeployResultParser) {
    const table = new Table();
    const titleType = this.getDeployType();

    const successes = parser.getSuccesses();
    const errors = parser.getErrors();
    const deployedSource = successes
      ? successes.result.deployedSource
      : undefined;
    if (deployedSource || parser.hasConflicts()) {
      const rows = deployedSource || (errors && errors.result);
      const title = !parser.hasConflicts()
        ? nls.localize(`table_title_${titleType}ed_source`)
        : undefined;
      const outputTable = this.getOutputTable(table, rows, title);
      if (parser.hasConflicts()) {
        channelService.appendLine(nls.localize('push_conflicts_error') + '\n');
      }
      channelService.appendLine(outputTable);
      if (deployedSource && deployedSource.length === 0) {
        const noResults = nls.localize('table_no_results_found') + '\n';
        channelService.appendLine(noResults);
      }
    }

    if (errors && !parser.hasConflicts()) {
      const { name, message, result } = errors;
      if (result) {
        const outputTable = this.getErrorTable(table, result, titleType);
        channelService.appendLine(outputTable);
      } else if (name && message) {
        channelService.appendLine(`${name}: ${message}\n`);
      }
    }
  }
}
