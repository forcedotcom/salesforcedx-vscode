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
import {
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { handleDiagnosticErrors } from '../diagnostics';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath } from '../util';
import { SfdxCommandletExecutor } from './commands';

export interface DeployParams {
  sourcePush: boolean;
  sourcePaths: string;
}

export class DeployParamsGatherer implements ParametersGatherer<DeployParams> {
  private sourcePush: boolean;
  private uris: vscode.Uri[] | undefined;
  public constructor(sourcePush: boolean, uris?: vscode.Uri[]) {
    this.sourcePush = sourcePush;
    this.uris = uris;
  }
  public async gather(): Promise<ContinueResponse<DeployParams>> {
    const sourcePaths = this.uris
      ? this.uris.map(uri => uri.fsPath).join(',')
      : '';
    return {
      type: 'CONTINUE',
      data: { sourcePush: this.sourcePush, sourcePaths }
    };
  }
}

export abstract class ForceSourceDeployExecutor extends SfdxCommandletExecutor<
  DeployParams
> {
  public static errorCollection = vscode.languages.createDiagnosticCollection(
    'deploy-errors'
  );

  public execute(response: ContinueResponse<DeployParams>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const workspacePath = getRootWorkspacePath() || '';
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
        const { sourcePush, sourcePaths } = response.data;
        const deployParser = new ForceDeployResultParser(stdOut);
        const errors = deployParser.getErrors();
        if (errors) {
          handleDiagnosticErrors(
            errors,
            workspacePath,
            sourcePaths,
            ForceSourceDeployExecutor.errorCollection
          );
        } else {
          ForceSourceDeployExecutor.errorCollection.clear();
        }
        this.outputResult(deployParser, sourcePush);
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

  public outputResult(parser: ForceDeployResultParser, sourcePush: boolean) {
    const table = new Table();
    const titleType = sourcePush ? 'push' : 'deploy';

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
        ],
        nls.localize(`table_title_${titleType}ed_source`)
      );
      channelService.appendLine(outputTable);
      if (deployedSource.length === 0) {
        const noResults = nls.localize('table_no_results_found') + '\n';
        channelService.appendLine(noResults);
      }
    }

    const errors = parser.getErrors();
    if (errors) {
      const { name, message, result } = errors;
      if (result) {
        const outputTable = table.createTable(
          (result as unknown) as Row[],
          [
            {
              key: 'filePath',
              label: nls.localize('table_header_project_path')
            },
            { key: 'error', label: nls.localize('table_header_errors') }
          ],
          nls.localize(`table_title_${titleType}_errors`)
        );
        channelService.appendLine(outputTable);
      } else if (name && message) {
        channelService.appendLine(`${name}: ${message}\n`);
      }
    }
  }
}
