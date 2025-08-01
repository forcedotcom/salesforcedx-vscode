/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, SfCommandBuilder } from '@salesforce/salesforcedx-utils';
import {
  CliCommandExecution,
  CliCommandExecutor,
  ContinueResponse,
  EmptyParametersGatherer,
  ProjectRetrieveStartResultParser,
  ProjectRetrieveStartResult,
  SfWorkspaceChecker,
  Table,
  TimingUtils
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { PersistentStorageService } from '../conflict';
import { PROJECT_RETRIEVE_START_LOG_NAME } from '../constants';
import { coerceMessageKey, nls } from '../messages';
import { CommandParams, FlagParameter, SfCommandlet, SfCommandletExecutor } from './util';

const pullCommand: CommandParams = {
  command: 'project:retrieve:start',
  description: {
    default: 'project_retrieve_start_default_org_text',
    ignoreConflicts: 'project_retrieve_start_ignore_conflicts_default_org_text'
  },
  logName: { default: PROJECT_RETRIEVE_START_LOG_NAME }
};

export class ProjectRetrieveStartExecutor extends SfCommandletExecutor<{}> {
  private flag: string | undefined;

  constructor(
    flag?: string,
    public params: CommandParams = pullCommand
  ) {
    super();
    this.flag = flag;
  }

  public build(_data: {}): Command {
    const builder = new SfCommandBuilder()
      .withDescription(nls.localize(coerceMessageKey(this.params.description.default)))
      .withArg(this.params.command)
      .withJson()
      .withLogName(this.params.logName.default);

    if (this.flag === '--ignore-conflicts') {
      builder
        .withArg(this.flag)
        .withDescription(nls.localize(coerceMessageKey(this.params.description.ignoreConflicts)));
    }
    return builder.build();
  }

  public execute(response: ContinueResponse<string>): void {
    const startTime = TimingUtils.getCurrentTime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: this.executionCwd,
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);
    channelService.streamCommandStartStop(execution);

    let output = '';
    execution.stdoutSubject.subscribe(realData => {
      output += realData.toString();
    });

    execution.processExitSubject.subscribe(exitCode => {
      this.exitProcessHandlerPull(exitCode, execution, response, startTime, output);
    });

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  protected exitProcessHandlerPull(
    exitCode: number | undefined,
    execution: CliCommandExecution,
    response: ContinueResponse<string>,
    startTime: number,
    output: string
  ): void {
    if (execution.command.logName === PROJECT_RETRIEVE_START_LOG_NAME) {
      const pullResult = this.parseOutput(output);
      if (exitCode === 0) {
        this.updateCache(pullResult);
      }
      const pullParser = new ProjectRetrieveStartResultParser(output);
      const errors = pullParser.getErrors();
      if (errors) {
        channelService.showChannelOutput();
      }

      this.outputResultPull(pullParser);
    }

    this.logMetric(execution.command.logName, startTime);
    this.onDidFinishExecutionEventEmitter.fire(startTime);
  }

  /**
   * Pass the pulled source to PersistentStorageService for
   * updating of timestamps, so that conflict detection will behave as expected
   * @param pullResult that comes from stdOut after cli pull operation
   */
  protected updateCache(pullResult: any): void {
    const pulledSource = pullResult.result.files;

    const instance = PersistentStorageService.getInstance();
    instance.setPropertiesForFilesPushPull(pulledSource);
  }

  public outputResultPull(parser: ProjectRetrieveStartResultParser) {
    const table = new Table();
    const titleType = 'pull';

    const successes = parser.getSuccesses();
    const errors = parser.getErrors();
    const pulledSource = successes ? successes?.result.files : undefined;
    if (pulledSource || parser.hasConflicts()) {
      const rows = pulledSource ?? errors?.files;
      const tableTitle = !parser.hasConflicts() ? nls.localize(`table_title_${titleType}ed_source`) : undefined;
      const outputTable = this.getOutputTable(table, rows, tableTitle);
      if (parser.hasConflicts()) {
        channelService.appendLine(`${nls.localize('pull_conflicts_error')}\n`);
      }
      channelService.appendLine(outputTable);
      if (pulledSource && pulledSource.length === 0) {
        const noResults = `${nls.localize('table_no_results_found')}\n`;
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
        console.log(`There were errors parsing the pull operation response.  Raw response: ${JSON.stringify(errors)}`);
      }
    }
  }

  protected getOutputTable(
    table: Table,
    rows: ProjectRetrieveStartResult[] | undefined,
    outputTableTitle: string | undefined
  ) {
    const outputTable = table.createTable(
      rows ?? [],
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

  protected getErrorTable(table: Table, result: ProjectRetrieveStartResult[], titleType: string) {
    const outputTable = table.createTable(
      result,
      [
        {
          key: 'filePath',
          label: nls.localize('table_header_project_path')
        },
        { key: 'error', label: nls.localize('table_header_errors') }
      ],
      nls.localize(coerceMessageKey(`table_title_${titleType}_errors`))
    );
    return outputTable;
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function projectRetrieveStart(this: FlagParameter<string>) {
  const { flag } = this || {};
  const executor = new ProjectRetrieveStartExecutor(flag, pullCommand);
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);
  await commandlet.run();
}
