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
import {
  RegistryAccess,
  SourceClient
} from '@salesforce/source-deploy-retrieve';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { handleDiagnosticErrors } from '../diagnostics';
import { nls } from '../messages';
import { notificationService, ProgressNotification } from '../notifications';
import { DeployQueue } from '../settings/pushOrDeployOnSave';
import { taskViewService } from '../statuses';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath } from '../util';
import { createComponentCount } from './util/betaDeployRetrieve';
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
    const workspacePath = getRootWorkspacePath() || '';
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
      let properties;
      const registryAccess = new RegistryAccess();
      try {
        const components = registryAccess.getComponentsFromPath(
          execFilePathOrPaths
        );
        const metadataCount = JSON.stringify(createComponentCount(components));
        properties = { metadataCount };
        // registry does not handle multiple paths. only log component count for single paths
      } catch (e) {
        telemetryService.sendException(
          e.name,
          'error detecting deployed components'
        );
      }
      this.logMetric(execution.command.logName, startTime, properties);

      try {
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
            BaseDeployExecutor.errorCollection.clear();
          }
          this.outputResult(deployParser);
        }
      } catch (e) {
        if (e.name !== 'DeployParserFail') {
          e.message =
            'Error while creating diagnostics for vscode problem view.';
        }
        telemetryService.sendException(e.name, e.message);
        console.error(e.message);
      }
      await DeployQueue.get().unlock();
    });

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
      const outputTable = table.createTable(
        (rows as unknown) as Row[],
        [
          { key: 'state', label: nls.localize('table_header_state') },
          { key: 'fullName', label: nls.localize('table_header_full_name') },
          { key: 'type', label: nls.localize('table_header_type') },
          { key: 'filePath', label: nls.localize('table_header_project_path') }
        ],
        title
      );
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
