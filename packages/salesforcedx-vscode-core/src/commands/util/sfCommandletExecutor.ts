/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Command, CommandExecution } from '@salesforce/salesforcedx-utils';
import {
  CliCommandExecutor,
  ContinueResponse,
  notificationService,
  ProgressNotification,
  workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { Properties, Measurements } from '@salesforce/vscode-service-provider';
import * as vscode from 'vscode';
import { channelService } from '../../channels';
import { telemetryService } from '../../telemetry';
import { CommandletExecutor } from './commandletExecutor';

export abstract class SfCommandletExecutor<T> implements CommandletExecutor<T> {
  public static errorCollection = vscode.languages.createDiagnosticCollection('push-errors');
  protected showChannelOutput = true;
  protected executionCwd = workspaceUtils.getRootWorkspacePath();
  protected onDidFinishExecutionEventEmitter = new vscode.EventEmitter<number>();
  public readonly onDidFinishExecution: vscode.Event<number> = this.onDidFinishExecutionEventEmitter.event;

  protected attachExecution(
    execution: CommandExecution,
    cancellationTokenSource: vscode.CancellationTokenSource,
    cancellationToken: vscode.CancellationToken
  ) {
    channelService.streamCommandOutput(execution);

    if (this.showChannelOutput) {
      channelService.showChannelOutput();
    }

    notificationService.reportCommandExecutionStatus(execution, channelService, cancellationToken);
    ProgressNotification.show(execution, cancellationTokenSource);
  }

  public logMetric(
    logName: string | undefined,
    startTime: number,
    properties?: Properties,
    measurements?: Measurements
  ) {
    telemetryService.sendCommandEvent(logName, startTime, properties, measurements);
  }

  public execute(response: ContinueResponse<T>): void | Promise<void> {
    const startTime = globalThis.performance.now();
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

  /**
   * Base method (no-op) that is overridden by sub-classes
   * projectDeployStart and projectRetrieveStart to update the local cache's
   * timestamps post-operation, in order to be in sync for the
   * "Detect Conflicts for Deploy and Retrieve" setting.
   */

  public abstract build(data: T): Command;
}
