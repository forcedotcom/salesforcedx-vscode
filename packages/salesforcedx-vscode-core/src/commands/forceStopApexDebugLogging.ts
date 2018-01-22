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
import * as vscode from 'vscode';
import { developerLogTraceFlag } from '.';
import { nls } from '../messages';
import {
  disposeTraceFlagExpiration,
  hideTraceFlagExpiration
} from '../traceflag-time-decorator';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';
import {
  debugLevelId,
  prevApexCodeDebugLevel,
  prevVFDebugLevel
} from './forceStartApexDebugLogging';

class ForceStopApexDebugLoggingExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return getRestoreLevelsCommand();
  }

  public execute(response: ContinueResponse<{}>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    execution.processExitSubject.subscribe(async data => {
      if (data != undefined && data.toString() === '0') {
        developerLogTraceFlag.turnOffLogging();
        hideTraceFlagExpiration();
      }
    });
  }
}

export async function restoreDebugLevels(): Promise<void> {
  if (developerLogTraceFlag.isActive()) {
    const execution = new CliCommandExecutor(getRestoreLevelsCommand(), {
      cwd: vscode.workspace.rootPath
    }).execute();
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

function getRestoreLevelsCommand(): Command {
  return new SfdxCommandBuilder()
    .withDescription(nls.localize('force_stop_apex_debug_logging'))
    .withArg('force:data:record:update')
    .withFlag('--sobjecttype', 'DebugLevel')
    .withFlag('--sobjectid', developerLogTraceFlag.getDebugLevelId())
    .withFlag(
      '--values',
      `ApexCode=${developerLogTraceFlag.getPrevApexCodeDebugLevel()} Visualforce=${developerLogTraceFlag.getPrevApexCodeDebugLevel()}`
    )
    .withArg('--usetoolingapi')
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

export function forceStopApexDebugLogging() {
  commandlet.run();
}
