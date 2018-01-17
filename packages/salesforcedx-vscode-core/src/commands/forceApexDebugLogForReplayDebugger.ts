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
  CancelResponse,
  ContinueResponse,
  EmptyParametersGatherer,
  ParametersGatherer,
  PostconditionChecker,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

let PREV_APEX_CODE_DEBUG_LEVEL: string;
let PREV_VISUALFORCE_DEBUG_LEVEL: string;
let DEBUG_LEVEL_ID: string;
export class ForceApexDebugLogForReplayDebuggerExecutor extends SfdxCommandletExecutor<
  TraceFlagInfo
> {
  public build(data: TraceFlagInfo): Command {
    return new SfdxCommandBuilder()
      .withDescription(
        nls.localize('force_apex_debug_log_replay_debugger_text')
      )
      .withArg('force:data:record:update')
      .withFlag('--sobjecttype', 'DebugLevel')
      .withFlag('--sobjectid', data.debugLevelId)
      .withFlag('--values', 'ApexCode=Finest Visualforce=Finest')
      .withArg('--usetoolingapi')
      .build();
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
          'select id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce from traceflag'
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
    if (resultJson.result.records.length > 0) {
      const traceflag = resultJson.result.records[0];
      DEBUG_LEVEL_ID = traceflag.DebugLevelId;
      PREV_APEX_CODE_DEBUG_LEVEL = traceflag.DebugLevel.ApexCode;
      PREV_VISUALFORCE_DEBUG_LEVEL = traceflag.DebugLevel.Visualforce;
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
      if (expDate.getTime() - startDate.valueOf() < 1800000) {
        expDate = new Date(Date.now() + 30 * 60000);
        console.log(
          `StartDate=${startDate.toUTCString()} ExpirationDate=${expDate.toUTCString()}`
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
            .build(),
          {
            cwd: vscode.workspace.rootPath
          }
        ).execute();
      }
      return inputs;
    }
    return { type: 'CANCEL' };
  }
}

export function debugLevelCleanUp() {
  if (PREV_APEX_CODE_DEBUG_LEVEL && PREV_VISUALFORCE_DEBUG_LEVEL) {
    const execution = new CliCommandExecutor(
      new SfdxCommandBuilder()
        .withArg('force:data:record:update')
        .withFlag('--sobjecttype', 'DebugLevel')
        .withFlag('--sobjectid', DEBUG_LEVEL_ID)
        .withFlag(
          '--values',
          `ApexCode=${PREV_APEX_CODE_DEBUG_LEVEL} Visualforce=${PREV_VISUALFORCE_DEBUG_LEVEL}`
        )
        .withArg('--usetoolingapi')
        .build(),
      {
        cwd: vscode.workspace.rootPath
      }
    ).execute();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new TraceFlagInfoGatherer();
const postconditionChecker = new TraceFlagStartEndChecker();

export function forceApexDebugLogForReplayDebugger() {
  // tslint:disable-next-line:no-invalid-this
  const executor = new ForceApexDebugLogForReplayDebuggerExecutor();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor,
    postconditionChecker
  );
  commandlet.run();
}
