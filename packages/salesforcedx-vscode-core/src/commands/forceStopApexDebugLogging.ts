/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandOutput,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { developerLogTraceFlag } from '.';
import { hideTraceFlagExpiration } from '../decorators';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { getRootWorkspacePath } from '../util';
import {
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

export class ForceStopApexDebugLoggingExecutor extends SfdxCommandletExecutor<{}> {
  public build(): Command {
    return deleteTraceFlag();
  }

  public execute(response: ContinueResponse<{}>): void {
    const startTime = process.hrtime();
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(), {
      cwd: getRootWorkspacePath()
    }).execute(cancellationToken);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    execution.processExitSubject.subscribe(async data => {
      this.logMetric(execution.command.logName, startTime);
      if (data !== undefined && data.toString() === '0') {
        developerLogTraceFlag.turnOffLogging();
        hideTraceFlagExpiration();
      }
    });
  }
}

export async function turnOffLogging(): Promise<void> {
  if (developerLogTraceFlag.isActive()) {
    const execution = new CliCommandExecutor(deleteTraceFlag(), {
      cwd: getRootWorkspacePath()
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
}

function deleteTraceFlag(): Command {
  const nonNullTraceFlag = developerLogTraceFlag.getTraceFlagId()!;
  return new SfdxCommandBuilder()
    .withDescription(nls.localize('force_stop_apex_debug_logging'))
    .withArg('force:data:record:delete')
    .withFlag('--sobjecttype', 'TraceFlag')
    .withFlag('--sobjectid', nonNullTraceFlag)
    .withArg('--usetoolingapi')
    .withLogName('force_stop_apex_debug_logging')
    .build();
}
class ActiveLogging implements ParametersGatherer<{}> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
    if (developerLogTraceFlag.isActive()) {
      return { type: 'CONTINUE', data: {} };
    }
    return { type: 'CANCEL' };
  }
}
const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new ActiveLogging();
const executor = new ForceStopApexDebugLoggingExecutor();
const commandlet = new SfdxCommandlet(
  workspaceChecker,
  parameterGatherer,
  executor
);

export async function forceStopApexDebugLogging() {
  await commandlet.run();
}
