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
import { CommandletExecutor, ContinueResponse } from '../types';
import { getRootWorkspacePath } from '../workspaces';
import { ChannelService } from './channelService';
import { notificationService, ProgressNotification } from './index';

export abstract class SfdxCommandletExecutor<T>
  implements CommandletExecutor<T> {
  private outputChannel?: vscode.OutputChannel;
  protected showChannelOutput = true;
  protected executionCwd = getRootWorkspacePath();
  protected onDidFinishExecutionEventEmitter = new vscode.EventEmitter<
    [number, number]
  >();
  public readonly onDidFinishExecution: vscode.Event<[number, number]> = this
    .onDidFinishExecutionEventEmitter.event;

  constructor(outputChannel?: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    if (this.outputChannel) {
      const channel = new ChannelService(this.outputChannel);
      channel.streamCommandOutput(execution);
      if (this.showChannelOutput) {
        channel.showChannelOutput();
      }
    }
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
  private readonly executionName: string;
  private readonly logName: string;
  private readonly outputChannel: vscode.OutputChannel;
  protected readonly telemetry = new TelemetryBuilder();

  /**
   * @param name Name visible to user while executing.
   * @param logName Name for logging purposes such as telemetry.
   * @param outputChannel VS Code output channel to report execution status to.
   */
  constructor(
    executionName: string,
    logName: string,
    outputChannel: vscode.OutputChannel
  ) {
    this.executionName = executionName;
    this.logName = logName;
    this.outputChannel = outputChannel;
  }

  /**
   * Core logic of the command.
   *
   * @param response Data from the parameter gathering step.
   * @returns Whether or not the execution was a success
   */
  public abstract run(response: ContinueResponse<T>): Promise<boolean>;

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
      telemetryService.sendCommandEvent(
        this.logName,
        startTime,
        properties,
        measurements
      );
    } catch (e) {
      telemetryService.sendException(e.name, e.message);
      notificationService.showFailedExecution(this.executionName);
      channelService.appendLine(e.message);
      channelService.showChannelOutput();
    }
  }
}
