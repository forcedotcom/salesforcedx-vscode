/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { CliCommandExecutor, Command, CommandExecution } from '../cli';
import {
  Measurements,
  Properties,
  TelemetryBuilder,
  TelemetryData,
  TelemetryService
} from '../index';
import { nls } from '../messages';
import { ContinueResponse } from '../types';
import { getRootWorkspacePath } from '../workspaces';
import { ChannelService } from './channelService';
import { notificationService, ProgressNotification } from './index';

export interface FlagParameter<T> {
  flag: T;
}

export interface CommandletExecutor<T> {
  execute(response: ContinueResponse<T>): void;
  readonly onDidFinishExecution?: vscode.Event<[number, number]>;
}

export abstract class SfdxCommandletExecutor<T>
  implements CommandletExecutor<T> {
  protected showChannelOutput = true;
  protected executionCwd = getRootWorkspacePath();
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
    notificationService.reportCommandExecutionStatus(
      execution,
      cancellationToken
    );
    ProgressNotification.show(execution, cancellationTokenSource);
  }

  public logMetric(
    logName: string | undefined,
    hrstart: [number, number],
    properties?: Properties,
    measurements?: Measurements
  ) {
    TelemetryService.getInstance().sendCommandEvent(
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

export abstract class LibraryCommandletExecutor<T>
  implements CommandletExecutor<T> {
  /**
   * Command name visible to user while executing.
   */
  protected abstract readonly executionName: string;
  /**
   * Command name for logging purposes such as telemetry
   */
  protected abstract readonly logName: string;
  /**
   * Output channel to report execution status to.
   */
  protected abstract readonly outputChannel: vscode.OutputChannel;
  protected readonly telemetry = new TelemetryBuilder();

  /**
   * Core logic of the command.
   *
   * @param response Data from the parameter gathering step.
   * @returns Whether or not the execution was a success
   */
  protected abstract run(response: ContinueResponse<T>): Promise<boolean>;

  public async execute(response: ContinueResponse<T>): Promise<void> {
    const startTime = process.hrtime();
    const channelService = new ChannelService(this.outputChannel);
    const telemetryService = TelemetryService.getInstance();

    channelService.showCommandWithTimestamp(
      `${nls.localize('channel_starting_message')}${this.executionName}\n`
    );

    try {
      const success = await vscode.window.withProgress(
        {
          title: nls.localize('progress_notification_text', this.executionName),
          location: vscode.ProgressLocation.Notification
        },
        () => this.run(response)
      );
      channelService.showCommandWithTimestamp(
        `${nls.localize('channel_end')} ${this.executionName}`
      );
      if (success) {
        notificationService
          .showSuccessfulExecution(this.executionName)
          .catch(e => console.error(e));
      } else {
        notificationService.showFailedExecution(this.executionName);
      }
      this.telemetry.addProperty('success', String(success));
      const { properties, measurements } = this.telemetry.build();
      await telemetryService.sendCommandEvent(
        this.logName,
        startTime,
        properties,
        measurements
      );
    } catch (e) {
      await telemetryService.sendException(e.name, e.message);
      notificationService.showFailedExecution(this.executionName);
      channelService.appendLine(e.message);
      channelService.showChannelOutput();
    }
  }
}
