/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecution,
  CliCommandExecutor,
  Command,
  ContinueResponse,
  ProjectDeployStartResultParser,
  ProjectDeployStartResult,
  Row,
  SfCommandBuilder,
  Table,
  TelemetryBuilder,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { PersistentStorageService } from '../conflict';
import { PROJECT_DEPLOY_START_LOG_NAME } from '../constants';
import { handlePushDiagnosticErrors } from '../diagnostics';
import { nls } from '../messages';
import { salesforceCoreSettings } from '../settings';
import { telemetryService } from '../telemetry';
import { DeployRetrieveExecutor } from './baseDeployRetrieve';
import {
  CommandParams,
  EmptyParametersGatherer,
  FlagParameter,
  SfCommandlet,
  SfCommandletExecutor,
  SfWorkspaceChecker
} from './util';

export enum DeployType {
  Deploy = 'deploy',
  Push = 'push'
}

export const pushCommand: CommandParams = {
  command: 'project:deploy:start',
  description: {
    default: 'project_deploy_start_default_org_text',
    ignoreConflicts: 'project_deploy_start_ignore_conflicts_default_org_text'
  },
  logName: { default: 'project_deploy_start_default_scratch_org' }
};

export class ProjectDeployStartExecutor extends SfCommandletExecutor<{}> {
  private flag: string | undefined;
  public constructor(
    flag?: string,
    public params: CommandParams = pushCommand,
    showChannelOutput: boolean = true
  ) {
    super();
    this.flag = flag;
    this.showChannelOutput = showChannelOutput;
  }

  protected getDeployType() {
    return DeployType.Push;
  }

  public build(data: {}): Command {
    const builder = new SfCommandBuilder()
      .withDescription(nls.localize(this.params.description.default))
      .withArg(this.params.command)
      .withJson()
      .withLogName(this.params.logName.default);
    if (this.flag === '--ignore-conflicts') {
      builder.withArg(this.flag);
      builder.withDescription(nls.localize(this.params.description.ignoreConflicts));
    }
    return builder.build();
  }

  public execute(response: ContinueResponse<string>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const workspacePath = workspaceUtils.getRootWorkspacePath() || '';
    const execFilePathOrPaths = this.getDeployType() === DeployType.Deploy ? response.data : '';
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: workspacePath,
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);
    channelService.streamCommandStartStop(execution);

    let stdOut = '';
    execution.stdoutSubject.subscribe(realData => {
      stdOut += realData.toString();
    });

    execution.processExitSubject.subscribe(async exitCode => {
      await this.exitProcessHandlerPush(
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
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  protected async exitProcessHandlerPush(
    exitCode: number | undefined,
    stdOut: string,
    workspacePath: string,
    execFilePathOrPaths: string,
    execution: CliCommandExecution,
    startTime: [number, number],
    cancellationToken: vscode.CancellationToken | undefined,
    cancellationTokenSource: vscode.CancellationTokenSource
  ): Promise<void> {
    if (execution.command.logName === PROJECT_DEPLOY_START_LOG_NAME) {
      const pushResult = this.parseOutput(stdOut);
      if (exitCode === 0) {
        this.updateCache(pushResult);
      }

      const telemetry = new TelemetryBuilder();
      let success = false;
      try {
        SfCommandletExecutor.errorCollection.clear();
        DeployRetrieveExecutor.errorCollection.clear();
        if (stdOut) {
          const pushParser = new ProjectDeployStartResultParser(stdOut);
          const errors = pushParser.getErrors();
          if (errors && !pushParser.hasConflicts()) {
            channelService.showChannelOutput();
            handlePushDiagnosticErrors(
              errors,
              workspacePath,
              execFilePathOrPaths,
              SfCommandletExecutor.errorCollection
            );
          } else {
            success = true;
          }
          this.outputResult(pushParser);
        }
      } catch (e) {
        SfCommandletExecutor.errorCollection.clear();
        DeployRetrieveExecutor.errorCollection.clear();
        if (e.name !== 'ProjectDeployStartParserFail') {
          e.message = 'Error while creating diagnostics for vscode problem view.';
        }
        telemetryService.sendException(execution.command.logName, `Error: name = ${e.name} message = ${e.message}`);
        console.error(e.message);
      }
      telemetry.addProperty('success', String(success));
      this.logMetric(execution.command.logName, startTime, telemetry.build().properties);
      this.onDidFinishExecutionEventEmitter.fire(startTime);
    }
  }

  /**
   * Pass the pushed source to PersistentStorageService for
   * updating of timestamps, so that conflict detection will behave as expected
   * @param pushResult that comes from stdOut after cli push operation
   */
  protected updateCache(pushResult: any): void {
    const pushedSource = pushResult.result.files;

    const instance = PersistentStorageService.getInstance();
    instance.setPropertiesForFilesPushPull(pushedSource);
  }

  public outputResult(parser: ProjectDeployStartResultParser) {
    const table = new Table();
    const titleType = this.getDeployType();

    const successes = parser.getSuccesses();
    const errors = parser.getErrors();
    const pushedSource = successes ? successes.result.files : undefined;
    if (pushedSource || parser.hasConflicts()) {
      const rows = pushedSource || (errors && errors.files);
      const title = !parser.hasConflicts() ? nls.localize(`table_title_${titleType}ed_source`) : undefined;
      const outputTable = this.getOutputTable(table, rows, title);
      if (parser.hasConflicts()) {
        channelService.appendLine(nls.localize('push_conflicts_error') + '\n');
      }
      channelService.appendLine(outputTable);
      if (pushedSource && pushedSource.length === 0) {
        const noResults = nls.localize('table_no_results_found') + '\n';
        channelService.appendLine(noResults);
      }
    }

    if (errors && !parser.hasConflicts()) {
      const { name, message, files } = errors;
      if (files) {
        const outputTable = this.getErrorTable(table, files, titleType);
        channelService.appendLine(outputTable);
      } else if (name && message) {
        channelService.appendLine(`${name}: ${message}\n`);
      } else {
        console.log(`There were errors parsing the push operation response.  Raw response: ${JSON.stringify(errors)}`);
      }
    }
  }

  protected getOutputTable(
    table: Table,
    rows: ProjectDeployStartResult[] | undefined,
    outputTableTitle: string | undefined
  ) {
    const outputTable = table.createTable(
      rows as unknown as Row[],
      [
        { key: 'state', label: nls.localize('table_header_state') },
        { key: 'fullName', label: nls.localize('table_header_full_name') },
        { key: 'type', label: nls.localize('table_header_type') },
        { key: 'filePath', label: nls.localize('table_header_project_path') }
      ],
      outputTableTitle
    );
    return outputTable;
  }

  protected getErrorTable(table: Table, result: unknown, titleType: string) {
    const outputTable = table.createTable(
      result as Row[],
      [
        {
          key: 'filePath',
          label: nls.localize('table_header_project_path')
        },
        { key: 'error', label: nls.localize('table_header_errors') }
      ],
      nls.localize(`table_title_${titleType}_errors`)
    );
    return outputTable;
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function projectDeployStart(this: FlagParameter<string>, isDeployOnSave: boolean) {
  const showOutputPanel = !(isDeployOnSave && !salesforceCoreSettings.getDeployOnSaveShowOutputPanel());

  const { flag } = this || {};
  const executor = new ProjectDeployStartExecutor(flag, pushCommand, showOutputPanel);

  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);
  await commandlet.run();
}
