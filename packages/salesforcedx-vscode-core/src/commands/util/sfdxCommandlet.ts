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
  CommandExecution,
  ContinueResponse,
  ForcePullResultParser,
  Measurements,
  ParametersGatherer,
  PostconditionChecker,
  PreconditionChecker,
  Properties,
  Row,
  StatusOutputRowType,
  Table,
  TelemetryData
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { FORCE_SOURCE_PULL_LOG_NAME } from '../../constants';
import { nls } from '../../messages';
import { notificationService, ProgressNotification } from '../../notifications';
import { sfdxCoreSettings } from '../../settings';
import { taskViewService } from '../../statuses';
import { telemetryService } from '../../telemetry';
import { workspaceUtils } from '../../util';
import { EmptyPostChecker } from './emptyPostChecker';

export interface FlagParameter<T> {
  flag?: T;
}

export interface CommandParams {
  readonly command: string;
  // handle to localized user facing help text, with entries for diff flags
  description: Record<string, string>;
  logName: Record<string, string>; // metric key
}

export interface CommandletExecutor<T> {
  execute(response: ContinueResponse<T>): void;
  readonly onDidFinishExecution?: vscode.Event<[number, number]>;
}

export abstract class SfdxCommandletExecutor<T>
  implements CommandletExecutor<T> {
  protected showChannelOutput = true;
  protected executionCwd = workspaceUtils.getRootWorkspacePath();
  protected onDidFinishExecutionEventEmitter = new vscode.EventEmitter<
    [number, number]
  >();
  public readonly onDidFinishExecution: vscode.Event<[number, number]> = this
    .onDidFinishExecutionEventEmitter.event;

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    const p = execution.command.logName;
    if (p !== FORCE_SOURCE_PULL_LOG_NAME) {
      channelService.streamCommandOutput(execution);
    }

    if (this.showChannelOutput) {
      channelService.showChannelOutput();
    }

    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  public logMetric(
    logName: string | undefined,
    hrstart: [number, number],
    properties?: Properties,
    measurements?: Measurements
  ) {
    telemetryService.sendCommandEvent(
      logName,
      hrstart,
      properties,
      measurements
    );
  }

  public execute(response: ContinueResponse<T>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: this.executionCwd,
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    let output = '';
    execution.stdoutSubject.subscribe(realData => {
      output += realData.toString();
    });

    execution.processExitSubject.subscribe(exitCode => {
      this.exitProcessHandler(exitCode, execution, response, startTime, output);
    });

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  protected exitProcessHandler(
    exitCode: number | undefined,
    execution: CliCommandExecution,
    response: ContinueResponse<T>,
    startTime: [number, number],
    output: string
  ): void {
    if (
      exitCode === 0 &&
      execution.command.logName === FORCE_SOURCE_PULL_LOG_NAME
    ) {
      const pullResult = JSON.parse(output);
      this.updateCache(pullResult);

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

  protected getTelemetryData(
    success: boolean,
    response: ContinueResponse<T>,
    output: string
  ): TelemetryData | undefined {
    return;
  }

  public outputResultPull(parser: ForcePullResultParser) {
    const table = new Table();
    const titleType = 'pull';

    const successes: any = parser.getSuccesses();
    const errors = parser.getErrors();
    const pulledSource = successes ? successes.result.pulledSource : undefined;
    if (pulledSource) {
      const rows = pulledSource || (errors && errors.result);
      const tableTitle = nls.localize(`table_title_${titleType}ed_source`);
      const outputTable = this.getOutputTable(table, rows, tableTitle);

      channelService.appendLine(outputTable);
      if (pulledSource && pulledSource.length === 0) {
        const noResults = nls.localize('table_no_results_found') + '\n';
        channelService.appendLine(noResults);
      }
    }

    if (errors) {
      const { name, message, result } = errors;
      if (result) {
        const outputTable = this.getErrorTable(table, result, titleType);
        channelService.appendLine(outputTable);
      } else if (name && message) {
        channelService.appendLine(`${name}: ${message}\n`);
      }
    }
  }

  protected getOutputTable(
    table: Table,
    rows: unknown,
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

  /**
   * @description Base method (no-op) that is overridden by sub-classes
   * forceSourcePush and forceSourcePull to update the local cache's
   * timestamps post-operation, in order to be in sync for the
   * "Detect Conflicts at Sync" setting.
   */
  protected updateCache(result: any): void {}

  public abstract build(data: T): Command;

  /**
   * @description Used by forceSourcePull to cache remote changes before
   * retrieving, in order to update the local cache's timestamps post-
   * operation.
   */
  protected getRemoteChanges?(): StatusOutputRowType[] | undefined;
}

export class SfdxCommandlet<T> {
  private readonly prechecker: PreconditionChecker;
  private readonly postchecker: PostconditionChecker<T>;
  private readonly gatherer: ParametersGatherer<T>;
  private readonly executor: CommandletExecutor<T>;
  public readonly onDidFinishExecution?: vscode.Event<[number, number]>;

  constructor(
    checker: PreconditionChecker,
    gatherer: ParametersGatherer<T>,
    executor: CommandletExecutor<T>,
    postchecker = new EmptyPostChecker()
  ) {
    this.prechecker = checker;
    this.gatherer = gatherer;
    this.executor = executor;
    this.postchecker = postchecker;
    if (this.executor.onDidFinishExecution) {
      this.onDidFinishExecution = this.executor.onDidFinishExecution;
    }
  }

  public async run(): Promise<void> {
    if (sfdxCoreSettings.getEnableClearOutputBeforeEachCommand()) {
      channelService.clear();
    }
    if (await this.prechecker.check()) {
      let inputs = await this.gatherer.gather();
      inputs = await this.postchecker.check(inputs);
      switch (inputs.type) {
        case 'CONTINUE':
          return this.executor.execute(inputs);
        case 'CANCEL':
          if (inputs.msg) {
            notificationService.showErrorMessage(inputs.msg);
          }
          return;
      }
    }
  }
}
