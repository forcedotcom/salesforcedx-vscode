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
import { developerLogDebugLevels } from '.';
import { nls } from '../messages';
import { disposeTraceFlagExpiration } from '../traceflag-time-decorator';
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
        developerLogDebugLevels.turnOffLogging();
        disposeTraceFlagExpiration();
      }
    });
  }
}

export function restoreDebugLevels() {
  if (prevApexCodeDebugLevel && prevVFDebugLevel) {
    const execution = new CliCommandExecutor(getRestoreLevelsCommand(), {
      cwd: vscode.workspace.rootPath
    }).execute();
  }
}

function getRestoreLevelsCommand(): Command {
  return new SfdxCommandBuilder()
    .withDescription(nls.localize('force_stop_apex_debug_logging'))
    .withArg('force:data:record:update')
    .withFlag('--sobjecttype', 'DebugLevel')
    .withFlag('--sobjectid', developerLogDebugLevels.getDebugLevelId())
    .withFlag(
      '--values',
      `ApexCode=${developerLogDebugLevels.getPrevApexCodeDebugLevel()} Visualforce=${developerLogDebugLevels.getPrevApexCodeDebugLevel()}`
    )
    .withArg('--usetoolingapi')
    .build();
}
class ActiveLogging implements ParametersGatherer<{}> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
    if (developerLogDebugLevels.isActive()) {
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
