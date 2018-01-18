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
import { nls } from '../messages';
import {
  disposeTraceFlagExpiration,
  showTraceFlagExpiration
} from '../traceflag-time-decorator';
import {
  CancelResponse,
  ContinueResponse,
  EmptyParametersGatherer,
  ParametersGatherer,
  PostconditionChecker,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

import { developerLogDebugLevels } from '.';

export let prevApexCodeDebugLevel: string;
export let prevVFDebugLevel: string;
export let debugLevelId: string;

const MILLISECONDS_PER_SECOND = 60000;
const LOG_TIMER_LENGTH_MINUTES = 30;

export class ForceStartApexDebugLoggingExecutor extends SfdxCommandletExecutor<
  TraceFlagInfo
> {
  public build(data: TraceFlagInfo): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_start_apex_debug_logging'))
      .withArg('force:data:record:update')
      .withFlag('--sobjecttype', 'DebugLevel')
      .withFlag('--sobjectid', data.debugLevelId)
      .withFlag('--values', 'ApexCode=Finest Visualforce=Finest')
      .withArg('--usetoolingapi')
      .build();
  }

  public execute(response: ContinueResponse<TraceFlagInfo>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    this.attachExecution(execution, cancellationTokenSource, cancellationToken);
    execution.processExitSubject.subscribe(async data => {
      if (data != undefined && data.toString() === '0') {
        showTraceFlagExpiration(response.data.expirationDate);
      }
    });
  }
}

export type TraceFlagInfo = {
  traceflagId: string;
  expirationDate: string;
  debugLevelId: string;
};
class TraceFlagInfoGatherer implements ParametersGatherer<TraceFlagInfo> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<TraceFlagInfo>
  > {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:data:soql:query')
        .withFlag(
          '--query',
          'SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce FROM TraceFlag'
        )
        .withArg('--usetoolingapi')
        .withArg('--json')
        .build(),
      {
        cwd: vscode.workspace.rootPath
      }
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    try {
      const resultJson = JSON.parse(result);
      if (resultJson.result.records.length > 0) {
        const traceflag = resultJson.result.records[0];
        developerLogDebugLevels.turnOnLogging(
          traceflag.DebugLevelId,
          traceflag.DebugLevel.ApexCode,
          traceflag.DebugLevel.Visualforce
        );
        return {
          type: 'CONTINUE',
          data: {
            traceflagId: traceflag.Id,
            expirationDate: traceflag.ExpirationDate,
            debugLevelId: traceflag.DebugLevelId
          }
        };
      } else {
        return { type: 'CANCEL' };
      }
    } catch (e) {
      return { type: 'CANCEL' };
    }
  }
}

export class TraceFlagStartEndChecker
  implements PostconditionChecker<TraceFlagInfo> {
  public async check(
    inputs: ContinueResponse<TraceFlagInfo> | CancelResponse
  ): Promise<ContinueResponse<TraceFlagInfo> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      const startDate = new Date();
      let expDate = new Date(inputs.data.expirationDate);
      if (
        expDate.getTime() - startDate.valueOf() <
        LOG_TIMER_LENGTH_MINUTES * MILLISECONDS_PER_SECOND
      ) {
        expDate = new Date(
          Date.now() + LOG_TIMER_LENGTH_MINUTES * MILLISECONDS_PER_SECOND
        );
        const execution = new CliCommandExecutor(
          new SfdxCommandBuilder()
            .withArg('force:data:record:update')
            .withFlag('--sobjecttype', 'TraceFlag')
            .withFlag('--sobjectid', inputs.data.traceflagId)
            .withFlag(
              '--values',
              `StartDate='${startDate.toUTCString()}' ExpirationDate='${expDate.toUTCString()}'`
            )
            .withArg('--usetoolingapi')
            .withArg('--json')
            .build(),
          {
            cwd: vscode.workspace.rootPath
          }
        ).execute();
        const cmdOutput = new CommandOutput();
        const result = await cmdOutput.getCmdResult(execution);
        const resultJson = JSON.parse(result);
        inputs.data.expirationDate = expDate.toLocaleTimeString();
      }
      return inputs;
    }
    return { type: 'CANCEL' };
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new TraceFlagInfoGatherer();
const postconditionChecker = new TraceFlagStartEndChecker();

export function forceStartApexDebugLogging() {
  // tslint:disable-next-line:no-invalid-this
  const executor = new ForceStartApexDebugLoggingExecutor();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor,
    postconditionChecker
  );
  commandlet.run();
}
