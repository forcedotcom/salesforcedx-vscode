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
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

export class ForceApexDebugLogForReplayDebuggerExecutor extends SfdxCommandletExecutor<
  ApexDebugLevelInfo
> {
  public build(data: ApexDebugLevelInfo): Command {
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

export type ApexDebugLevelInfo = {
  debugLevelId: string;
  apexCodeDebugLevel: string;
  vfCodeDebugLevel: string;
};
class ApexDebugLevelGatherer implements ParametersGatherer<ApexDebugLevelInfo> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<ApexDebugLevelInfo>
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
        cwd: vscode.workspace.rootPath!
      }
    ).execute();

    const cmdOutput = new CommandOutput();
    const result = await cmdOutput.getCmdResult(execution);
    const resultJson = JSON.parse(result);
    console.log(resultJson);
    const apexCodeDebugLevel = resultJson.result.records[0].DebugLevel.ApexCode;
    const vfCodeDebugLevel =
      resultJson.result.records[0].DebugLevel.Visualforce;
    const debugLevelId = resultJson.result.records[0].DebugLevelId;
    return {
      type: 'CONTINUE',
      data: {
        debugLevelId,
        apexCodeDebugLevel,
        vfCodeDebugLevel
      }
    };
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new ApexDebugLevelGatherer();

export function forceApexDebugLogForReplayDebugger() {
  // tslint:disable-next-line:no-invalid-this
  const executor = new ForceApexDebugLogForReplayDebuggerExecutor();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  commandlet.run();
}
