/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor, Command, CommandOutput, SfCommandBuilder } from '@salesforce/salesforcedx-utils-vscode';
import { CancelResponse, ContinueResponse, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { hideTraceFlagExpiration } from '../decorators';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { workspaceUtils } from '../util';
import { developerLogTraceFlag } from '.';
import { SfCommandlet, SfCommandletExecutor, SfWorkspaceChecker } from './util';

export class StopApexDebugLoggingExecutor extends SfCommandletExecutor<{}> {
  public build(): Command {
    return deleteTraceFlag();
  }

  public execute(response: ContinueResponse<{}>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(), {
      cwd: workspaceUtils.getRootWorkspacePath()
    }).execute(cancellationToken);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    execution.processExitSubject.subscribe(async data => {
      this.logMetric(execution.command.logName, startTime);
      if (data !== undefined && String(data) === '0') {
        developerLogTraceFlag.turnOffLogging();
        hideTraceFlagExpiration();
      }
    });
  }
}

export const turnOffLogging = async (): Promise<void> => {
  if (developerLogTraceFlag.isActive()) {
    const execution = new CliCommandExecutor(deleteTraceFlag(), {
      cwd: workspaceUtils.getRootWorkspacePath()
    }).execute();
    telemetryService.sendCommandEvent(execution.command.logName);
    const resultPromise = new CommandOutput().getCmdResult(execution);
    const result = await resultPromise;
    const resultJson = JSON.parse(result);
    if (resultJson.status === 0) {
      return Promise.resolve();
    } else {
      return Promise.reject('Restoring the debug levels failed.');
    }
  }
};

const deleteTraceFlag = (): Command => {
  const nonNullTraceFlag = developerLogTraceFlag.getTraceFlagId()!;
  return new SfCommandBuilder()
    .withDescription(nls.localize('stop_apex_debug_logging'))
    .withArg('data:delete:record')
    .withFlag('--sobject', 'TraceFlag')
    .withFlag('--record-id', nonNullTraceFlag)
    .withArg('--use-tooling-api')
    .withLogName('stop_apex_debug_logging')
    .build();
};
class ActiveLogging implements ParametersGatherer<{}> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
    if (developerLogTraceFlag.isActive()) {
      return { type: 'CONTINUE', data: {} };
    }
    return { type: 'CANCEL' };
  }
}
const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new ActiveLogging();
const executor = new StopApexDebugLoggingExecutor();
const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);

export const stopApexDebugLogging = async (): Promise<void> => {
  await commandlet.run();
};
