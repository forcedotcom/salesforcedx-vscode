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
  ForcePullResultParser,
  PullResult,
  Row,
  SfdxCommandBuilder,
  Table
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { PersistentStorageService } from '../conflict';
import { FORCE_SOURCE_PULL_LOG_NAME } from '../constants';
import { nls } from '../messages';
import {
  CommandParams,
  EmptyParametersGatherer,
  FlagParameter,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export const pullCommand: CommandParams = {
  command: 'force:source:pull',
  description: {
    default: 'force_source_pull_default_org_text',
    forceoverwrite: 'force_source_pull_force_default_org_text'
  },
  logName: { default: FORCE_SOURCE_PULL_LOG_NAME }
};

export class ForceSourcePullExecutor extends SfdxCommandletExecutor<{}> {
  private flag: string | undefined;

  public constructor(
    flag?: string,
    public params: CommandParams = pullCommand
  ) {
    super();
    this.flag = flag;
  }

  public build(data: {}): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize(this.params.description.default))
      .withArg(this.params.command)
      .withJson()
      .withLogName(this.params.logName.default);

    if (this.flag === '--forceoverwrite') {
      builder
        .withArg(this.flag)
        .withDescription(nls.localize(this.params.description.forceoverwrite));
    }
    return builder.build();
  }

  public execute(response: ContinueResponse<string>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: this.executionCwd,
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);
    channelService.streamCommandStartStop(execution);

    let output = '';
    execution.stdoutSubject.subscribe(realData => {
      output += realData.toString();
    });

    execution.processExitSubject.subscribe(exitCode => {
      this.exitProcessHandlerPull(
        exitCode,
        execution,
        response,
        startTime,
        output
      );
    });

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  protected exitProcessHandlerPull(
    exitCode: number | undefined,
    execution: CliCommandExecution,
    response: ContinueResponse<string>,
    startTime: [number, number],
    output: string
  ): void {
    if (execution.command.logName === FORCE_SOURCE_PULL_LOG_NAME) {
      const pullResult = this.parseOutput(output);
      if (exitCode === 0) {
        this.updateCache(pullResult);
      }
      const pullParser = new ForcePullResultParser(output);
      const errors = pullParser.getErrors();
      if (errors) {
        channelService.showChannelOutput();
      }

      this.outputResultPull(pullParser);
    }

    const telemetryData = this.getTelemetryData(
      exitCode === 0,
      response,
      output
    );
    let properties;
    let measurements;
    if (telemetryData) {
      properties = telemetryData.properties;
      measurements = telemetryData.measurements;
    }
    this.logMetric(
      execution.command.logName,
      startTime,
      properties,
      measurements
    );
    this.onDidFinishExecutionEventEmitter.fire(startTime);
  }

  /**
   * Pass the pulled source to PersistentStorageService for
   * updating of timestamps, so that conflict detection will behave as expected
   * @param pullResult that comes from stdOut after cli pull operation
   */
  protected updateCache(pullResult: any): void {
    const pulledSource = pullResult.result.pulledSource;

    const instance = PersistentStorageService.getInstance();
    instance.setPropertiesForFilesPushPull(pulledSource);
  }

  public outputResultPull(parser: ForcePullResultParser) {
    const table = new Table();
    const titleType = 'pull';

    const successes = parser.getSuccesses();
    const errors = parser.getErrors();
    const pulledSource = successes ? successes?.result.pulledSource : undefined;
    if (pulledSource || parser.hasConflicts()) {
      const rows = pulledSource || errors?.data;
      const tableTitle = !parser.hasConflicts()
        ? nls.localize(`table_title_${titleType}ed_source`)
        : undefined;
      const outputTable = this.getOutputTable(table, rows, tableTitle);
      if (parser.hasConflicts()) {
        channelService.appendLine(nls.localize('pull_conflicts_error') + '\n');
      }
      channelService.appendLine(outputTable);
      if (pulledSource && pulledSource.length === 0) {
        const noResults = nls.localize('table_no_results_found') + '\n';
        channelService.appendLine(noResults);
      }
    }

    if (errors && !parser.hasConflicts()) {
      const { name, message, data } = errors;
      if (data) {
        const outputTable = this.getErrorTable(table, data, titleType);
        channelService.appendLine(outputTable);
      } else if (name && message) {
        channelService.appendLine(`${name}: ${message}\n`);
      } else {
        console.log(
          `There were errors parsing the pull operation response.  Raw response: ${errors}`
        );
      }
    }
  }

  protected getOutputTable(
    table: Table,
    rows: PullResult[] | undefined,
    outputTableTitle: string | undefined
  ) {
    const outputTable = table.createTable(
      (rows as unknown) as Row[],
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
    return outputTable;
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export async function forceSourcePull(this: FlagParameter<string>) {
  const { flag } = this || {};
  const executor = new ForceSourcePullExecutor(flag, pullCommand);
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
