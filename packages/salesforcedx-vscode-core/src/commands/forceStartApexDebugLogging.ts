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
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { APEX_CODE_DEBUG_LEVEL, VISUALFORCE_DEBUG_LEVEL } from '../constants';
import { nls } from '../messages';
import { CancellableStatusBar, taskViewService } from '../statuses';
import { showTraceFlagExpiration } from '../traceflag-time-decorator';
import {
  CompositeSfdxCommandletExecutor,
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './commands';

import { developerLogTraceFlag } from '.';

export class ForceStartApexDebugLoggingExecutor extends SfdxCommandletExecutor<{}> {
  public build(): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_start_apex_debug_logging'))
      .withArg('force:data:soql:query')
      .withFlag(
        '--query',
        "SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce FROM TraceFlag WHERE logtype='DEVELOPER_LOG'"
      )
      .withArg('--usetoolingapi')
      .withArg('--json')
      .build();
  }

  public async execute(response: ContinueResponse<{}>): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    const resultPromise = new CommandOutput().getCmdResult(execution);
    this.attachExecution(execution, cancellationTokenSource, cancellationToken);

    try {
      const result = await resultPromise;
      const resultJson = JSON.parse(result);
      if (resultJson && resultJson.result && resultJson.result.size >= 1) {
        const traceflag = resultJson.result.records[0];
        developerLogTraceFlag.setTraceFlagDebugLevelInfo(
          traceflag.Id,
          traceflag.StartDate,
          traceflag.ExpirationDate,
          traceflag.DebugLevelId,
          traceflag.DebugLevel.ApexCode,
          traceflag.DebugLevel.Visualforce
        );
        developerLogTraceFlag.turnOnLogging();

        const updateDebugLevelsCommandlet = new SfdxCommandlet(
          new SfdxWorkspaceChecker(),
          new EmptyParametersGatherer(),
          new UpdateDebugLevelsExecutor()
        );
        const promises = [updateDebugLevelsCommandlet.run()];

        let updateTraceFlagCommandlet;
        if (!developerLogTraceFlag.isValidDateLength()) {
          developerLogTraceFlag.validateDates();
          updateTraceFlagCommandlet = new SfdxCommandlet(
            new SfdxWorkspaceChecker(),
            new EmptyParametersGatherer(),
            new UpdateTraceFlagsExecutor()
          );
        }
        if (updateTraceFlagCommandlet) {
          promises.push(updateTraceFlagCommandlet.run());
        }

        const updatePromise = Promise.all(promises);
        await updatePromise;
      } else {
        const createDebuglevelCommandlet = new SfdxCommandlet(
          new SfdxWorkspaceChecker(),
          new EmptyParametersGatherer(),
          new CreateDebugLevel()
        );
        await createDebuglevelCommandlet.run();
        const userId = await getUserId(
          vscode.workspace.workspaceFolders![0].uri.fsPath
        );
        const createTraceFlagCommandlet = new SfdxCommandlet(
          new SfdxWorkspaceChecker(),
          new EmptyParametersGatherer(),
          new CreateTraceFlag(userId)
        );
        await createTraceFlagCommandlet.run();
      }
      // run executors to update traceflag and debug levels
      // tslint:disable-next-line:no-empty
    } catch (e) {}
  }
}

export async function getUserId(projectPath: string): Promise<string> {
  const execution = new CliCommandExecutor(
    new SfdxCommandBuilder()
      .withArg('force:user:display')
      .withArg('--json')
      .build(),
    { cwd: projectPath }
  ).execute();
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  try {
    const orgInfo = JSON.parse(result).result.id;
    return Promise.resolve(orgInfo);
  } catch (e) {
    return Promise.reject(result);
  }
}

export class CreateDebugLevel extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_start_apex_debug_logging'))
      .withArg('force:data:record:create')
      .withFlag('--sobjecttype', 'DebugLevel')
      .withFlag(
        '--values',
        `developername=ReplayDebuggerLevels${Date.now()} MasterLabel=ReplayDebuggerLevels${Date.now()} apexcode=${APEX_CODE_DEBUG_LEVEL} visualforce=${VISUALFORCE_DEBUG_LEVEL}`
      )
      .withArg('--usetoolingapi')
      .withArg('--json')
      .build();
  }

  public async execute(response: ContinueResponse<{}>): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);
    const resultPromise = new CommandOutput().getCmdResult(execution);
    try {
      const result = await resultPromise;
      const resultJson = JSON.parse(result);
      const debugLevelId = resultJson.result.id;
      developerLogTraceFlag.setDebugLevelInfo(
        debugLevelId,
        APEX_CODE_DEBUG_LEVEL,
        VISUALFORCE_DEBUG_LEVEL
      );
      channelService.streamCommandOutput(execution);
      channelService.showChannelOutput();
      CancellableStatusBar.show(execution, cancellationTokenSource);
      taskViewService.addCommandExecution(execution, cancellationTokenSource);
    } catch (e) {
      console.log(e);
    }
  }
}

export class CreateTraceFlag extends SfdxCommandletExecutor<{}> {
  private userId: string;

  public constructor(userId: string) {
    super();
    this.userId = userId;
  }

  public build(): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_start_apex_debug_logging'))
      .withArg('force:data:record:create')
      .withFlag('--sobjecttype', 'TraceFlag')
      .withFlag(
        '--values',
        `tracedentityid='${this
          .userId}' logtype=developer_log debuglevelid=${developerLogTraceFlag.getDebugLevelId()}`
      )
      .withArg('--usetoolingapi')
      .build();
  }

  public async execute(response: ContinueResponse<{}>): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    const execution = new CliCommandExecutor(this.build(), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    channelService.streamCommandOutput(execution);
    channelService.showChannelOutput();
    CancellableStatusBar.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

export class UpdateDebugLevelsExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_start_apex_debug_logging'))
      .withArg('force:data:record:update')
      .withFlag('--sobjecttype', 'DebugLevel')
      .withFlag('--sobjectid', developerLogTraceFlag.getDebugLevelId())
      .withFlag(
        '--values',
        `ApexCode=${APEX_CODE_DEBUG_LEVEL} Visualforce=${VISUALFORCE_DEBUG_LEVEL}`
      )
      .withArg('--usetoolingapi')
      .withArg('--json')
      .build();
  }
  public updateResponse(data: any, resultJson: any): void {
    showTraceFlagExpiration(
      developerLogTraceFlag.getExpirationDate().toLocaleString()
    );
  }
}

export class UpdateTraceFlagsExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_start_apex_debug_logging'))
      .withArg('force:data:record:update')
      .withFlag('--sobjecttype', 'TraceFlag')
      .withFlag('--sobjectid', developerLogTraceFlag.getTraceFlagId())
      .withFlag(
        '--values',
        `StartDate='${developerLogTraceFlag
          .getStartDate()
          .toUTCString()}' ExpirationDate='${developerLogTraceFlag
          .getExpirationDate()
          .toUTCString()}'`
      )
      .withArg('--usetoolingapi')
      .withArg('--json')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

class Test extends CompositeSfdxCommandletExecutor<any> {
  public build(data: any): Command {
    return new SfdxCommandBuilder().withDescription('test').build();
  }
}

export class ForceQueryTraceFlag extends SfdxCommandletExecutor<any> {
  public build(): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_start_apex_debug_logging'))
      .withArg('force:data:soql:query')
      .withFlag(
        '--query',
        "SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce FROM TraceFlag WHERE logtype='DEVELOPER_LOG'"
      )
      .withArg('--usetoolingapi')
      .withArg('--json')
      .build();
  }

  public updateResponse(data: any, resultJson: any): void {
    if (resultJson && resultJson.result && resultJson.result.size >= 1) {
      const traceflag = resultJson.result.records[0];
      developerLogTraceFlag.setTraceFlagDebugLevelInfo(
        traceflag.Id,
        traceflag.StartDate,
        traceflag.ExpirationDate,
        traceflag.DebugLevelId,
        traceflag.DebugLevel.ApexCode,
        traceflag.DebugLevel.Visualforce
      );
      developerLogTraceFlag.turnOnLogging();
      developerLogTraceFlag.validateDates();
    }
  }
}

export function forceStartApexDebugLogging() {
  // tslint:disable-next-line:no-invalid-this
  const executor = new ForceStartApexDebugLoggingExecutor();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    new Test(
      new ForceQueryTraceFlag(),
      new UpdateDebugLevelsExecutor(),
      new UpdateTraceFlagsExecutor()
    )
  );
  commandlet.run();
}
