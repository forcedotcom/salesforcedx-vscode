/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  CliCommandExecutor,
  Command,
  CommandExecution
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  ContinueResponse,
  ParametersGatherer,
  PostconditionChecker,
  PreconditionChecker
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { EmptyPostChecker } from '.';
import { channelService } from '../../channels';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import { TelemetryData, telemetryService } from '../../telemetry';
import { getRootWorkspacePath } from '../../util';

export interface FlagParameter<T> {
  flag: T;
}

export interface CommandletExecutor<T> {
  execute(response: ContinueResponse<T>): void;
}

export abstract class SfdxCommandletExecutor<T>
  implements CommandletExecutor<T> {
  protected showChannelOutput = true;

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    channelService.streamCommandOutput(execution);

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
    executionTime: [number, number],
    additionalData?: any
  ) {
    telemetryService.sendCommandEvent(logName, executionTime, additionalData);
  }

  public execute(response: ContinueResponse<T>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: getRootWorkspacePath(),
      env: { SFDX_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    let output = '';
    execution.stdoutSubject.subscribe(realData => {
      output += realData.toString();
    });

    execution.processExitSubject.subscribe(exitCode => {
      const telemetryData = this.getTelemetryData(
        exitCode === 0,
        response,
        output
      );
      let properties;
      if (telemetryData) {
        properties = telemetryData.properties;
      }
      this.logMetric(execution.command.logName, startTime, properties);
    });
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  protected getTelemetryData(
    success: boolean,
    response: ContinueResponse<T>,
    output: string
  ): TelemetryData | undefined {
    return;
  }

  public abstract build(data: T): Command;
}

export class SfdxCommandlet<T> {
  private readonly prechecker: PreconditionChecker;
  private readonly postchecker: PostconditionChecker<T>;
  private readonly gatherer: ParametersGatherer<T>;
  private readonly executor: CommandletExecutor<T>;

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
  }

  public async run(): Promise<void> {
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
