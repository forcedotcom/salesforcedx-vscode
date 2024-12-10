/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor, Command, CommandExecution, ContinueResponse } from '@salesforce/salesforcedx-utils-vscode';
import { Properties, Measurements, TelemetryData } from '@salesforce/vscode-service-provider';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { PROJECT_RETRIEVE_START_LOG_NAME, PROJECT_DEPLOY_START_LOG_NAME } from '../../constants';
import { nls } from '../../messages';
import { notificationService, ProgressNotification } from '../../notifications';
import { taskViewService } from '../../statuses';
import { telemetryService } from '../../telemetry';
import { workspaceUtils } from '../../util';
import { CommandletExecutor } from './commandletExecutor';

export abstract class SfCommandletExecutor<T> implements CommandletExecutor<T> {
  public static errorCollection = vscode.languages.createDiagnosticCollection('push-errors');
  protected showChannelOutput = true;
  protected executionCwd = workspaceUtils.getRootWorkspacePath();
  protected onDidFinishExecutionEventEmitter = new vscode.EventEmitter<[number, number]>();
  public readonly onDidFinishExecution: vscode.Event<[number, number]> = this.onDidFinishExecutionEventEmitter.event;

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    const commandLogName = execution.command.logName;
    // If Push or Pull operation, output text will be
    // generated later using a parser.
    if (!(commandLogName === PROJECT_RETRIEVE_START_LOG_NAME || commandLogName === PROJECT_DEPLOY_START_LOG_NAME)) {
      channelService.streamCommandOutput(execution);
    }

    if (this.showChannelOutput) {
      channelService.showChannelOutput();
    }

    notificationService.reportCommandExecutionStatus(execution, cancellationToken);
    ProgressNotification.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }

  public logMetric(
    logName: string | undefined,
    hrstart: [number, number],
    properties?: Properties,
    measurements?: Measurements
  ) {
    telemetryService.sendCommandEvent(logName, hrstart, properties, measurements);
  }

  public execute(response: ContinueResponse<T>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: this.executionCwd,
      env: { SF_JSON_TO_STDOUT: 'true' }
    }).execute(cancellationToken);

    let output = '';
    execution.stdoutSubject.subscribe(realData => {
      output += realData.toString();
    });

    execution.processExitSubject.subscribe(exitCode => {
      const telemetryData = this.getTelemetryData(exitCode === 0, response, output);
      let properties;
      let measurements;
      if (telemetryData) {
        properties = telemetryData.properties;
        measurements = telemetryData.measurements;
      }
      this.logMetric(execution.command.logName, startTime, properties, measurements);
      this.onDidFinishExecutionEventEmitter.fire(startTime);
    });
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
  }

  /**
   * Shows a notification and the raw response
   * before throwing when a parsing error is encountered.
   * @param output usually stdOut JSON string from a cli command.
   * @returns parsed JSON object.
   */
  protected parseOutput(output: string) {
    let parsed: JSON;
    try {
      parsed = JSON.parse(output);
    } catch (error) {
      console.log(`There was an error parsing the output. Raw output: ${output}`);

      notificationService.showWarningMessage(nls.localize('lib_retrieve_result_parse_error'));
      throw error;
    }
    return parsed;
  }

  protected getTelemetryData(
    success: boolean,
    response: ContinueResponse<T>,
    output: string
  ): TelemetryData | undefined {
    return;
  }

  /**
   * Base method (no-op) that is overridden by sub-classes
   * projectDeployStart and projectRetrieveStart to update the local cache's
   * timestamps post-operation, in order to be in sync for the
   * "Detect Conflicts at Sync" setting.
   */

  protected updateCache(result: any): void {}

  public abstract build(data: T): Command;
}
