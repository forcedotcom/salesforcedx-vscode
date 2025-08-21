/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Command } from '@salesforce/salesforcedx-utils';
import * as vscode from 'vscode';
import { CliCommandExecutor, CommandExecution } from '../cli';
import { TimingUtils } from '../helpers/timingUtils';
import { TelemetryBuilder, TelemetryService } from '../index';
import { nls } from '../messages';
import { SettingsService } from '../settings';
import { Properties, Measurements, TelemetryData, CommandletExecutor, ContinueResponse } from '../types';
import { getRootWorkspacePath } from '../workspaces';
import { ChannelService } from './channelService';
import { ProgressNotification, notificationService } from './index';

export abstract class SfCommandletExecutor<T> implements CommandletExecutor<T> {
  private outputChannel?: vscode.OutputChannel;
  protected showChannelOutput = true;
  protected executionCwd = getRootWorkspacePath();
  protected onDidFinishExecutionEventEmitter = new vscode.EventEmitter<number>();
  public readonly onDidFinishExecution: vscode.Event<number> = this.onDidFinishExecutionEventEmitter.event;

  constructor(outputChannel?: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    let channel;
    if (this.outputChannel) {
      channel = new ChannelService(this.outputChannel);
      channel.streamCommandOutput(execution);
      if (this.showChannelOutput) {
        channel.showChannelOutput();
      }
    }
    notificationService.reportCommandExecutionStatus(execution, channel, cancellationToken);
    ProgressNotification.show(execution, cancellationTokenSource);
  }

  public logMetric(
    logName: string | undefined,
    startTime: number,
    properties?: Properties,
    measurements?: Measurements
  ) {
    TelemetryService.getInstance().sendCommandEvent(logName, startTime, properties, measurements);
  }

  public execute(response: ContinueResponse<T>): void {
    const startTime = TimingUtils.getCurrentTime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: this.executionCwd,
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    execution.processExitSubject.subscribe(() => {
      this.logMetric(execution.command.logName, startTime);
      this.onDidFinishExecutionEventEmitter.fire(startTime);
    });
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  public abstract build(data: T): Command;
}

export abstract class LibraryCommandletExecutor<T> implements CommandletExecutor<T> {
  protected cancellable: boolean = false;
  private cancelled: boolean = false;
  protected readonly executionName: string;
  protected readonly logName: string;
  private readonly outputChannel: vscode.OutputChannel;
  protected showChannelOutput = true;
  protected showSuccessNotifications = true;
  protected showFailureNotifications = true;
  protected readonly telemetry = new TelemetryBuilder();

  /**
   * @param executionName Name visible to user while executing.
   * @param logName Name for logging purposes such as telemetry.
   * @param outputChannel VS Code output channel to report execution status to.
   */
  constructor(executionName: string, logName: string, outputChannel: vscode.OutputChannel) {
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
  public abstract run(
    response: ContinueResponse<T>,
    progress?: vscode.Progress<{
      message?: string | undefined;
      increment?: number | undefined;
    }>,
    token?: vscode.CancellationToken
  ): Promise<boolean>;

  public async execute(response: ContinueResponse<T>): Promise<void> {
    const startTime = TimingUtils.getCurrentTime();
    const channelService = new ChannelService(this.outputChannel);
    const telemetryService = TelemetryService.getInstance();
    if (SettingsService.getEnableClearOutputBeforeEachCommand()) {
      channelService.clear();
    }

    channelService.showCommandWithTimestamp(`${nls.localize('channel_starting_message')}${this.executionName}\n`);

    try {
      const success = await vscode.window.withProgress(
        {
          title: nls.localize('progress_notification_text', this.executionName),
          location: vscode.ProgressLocation.Notification,
          cancellable: this.cancellable
        },
        (progress, token) => {
          token.onCancellationRequested(() => {
            this.cancelled = true;
            notificationService.showCanceledExecution(this.executionName);

            telemetryService.sendCommandEvent(`${this.logName}_cancelled`, startTime, properties, measurements);
          });
          return this.run(response, progress, token);
        }
      );
      channelService.showCommandWithTimestamp(`${nls.localize('channel_end')} ${this.executionName}`);

      if (this.showChannelOutput) {
        channelService.showChannelOutput();
      }

      if (!this.cancelled) {
        if (success && this.showSuccessNotifications) {
          notificationService.showSuccessfulExecution(this.executionName, channelService).catch(e => console.error(e));
        } else if (!success && this.showFailureNotifications) {
          notificationService.showFailedExecution(this.executionName);
        }
      }

      this.telemetry.addProperty('success', String(success));
      const { properties, measurements } = this.telemetry.build();
      telemetryService.sendCommandEvent(this.logName, startTime, properties, measurements);
    } catch (e) {
      if (e instanceof Error) {
        telemetryService.sendException(
          `LibraryCommandletExecutor - ${this.logName}`,
          `Error: name = ${e.name} message = ${e.message}`
        );
        notificationService.showFailedExecution(this.executionName);
        channelService.appendLine(e.message);
      }
      channelService.showChannelOutput();
    }
  }

  public get telemetryData(): TelemetryData {
    return this.telemetry.build();
  }
}
