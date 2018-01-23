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
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { nls } from '../messages';
import { CancellableStatusBar, taskViewService } from '../statuses';
import { showTraceFlagExpiration } from '../traceflag-time-decorator';
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

import { developerLogTraceFlag } from '.';

const MILLISECONDS_PER_SECOND = 60000;
const LOG_TIMER_LENGTH_MINUTES = 30;
const CONFIG_DIR = vscode.workspace.rootPath
  ? path.join(vscode.workspace.rootPath, '.sfdx')
  : path.join(os.homedir(), '.sfdx');
const CONFIG_FILE = path.join(CONFIG_DIR, 'sfdx-config.json');
const ALIAS_FILE = path.join(CONFIG_DIR, 'alias.json');

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
        const createTraceFlagCommandlet = new SfdxCommandlet(
          new SfdxWorkspaceChecker(),
          new EmptyParametersGatherer(),
          new CreateTraceFlag()
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
      .withDescription('')
      .withArg('force:data:record:create')
      .withFlag('--sobjecttype', 'DebugLevel')
      .withFlag(
        '--values',
        `developername=ReplayDebuggerLevels${Date.now()} MasterLabel=ReplayDebuggerLevels${Date.now()} apexcode=finest visualforce=finest`
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
      developerLogTraceFlag.setDebugLevelInfo(debugLevelId, 'FINEST', 'FINEST');
      channelService.streamCommandOutput(execution);
      channelService.showChannelOutput();
      CancellableStatusBar.show(execution, cancellationTokenSource);
      taskViewService.addCommandExecution(execution, cancellationTokenSource);
    } catch (e) {
      console.log(e);
    }
  }
}

export class CreateTraceFlag extends SfdxCommandletExecutor<{ id: string }> {
  public build(data: { id: string }): Command {
    return new SfdxCommandBuilder()
      .withDescription('')
      .withArg('force:data:record:create')
      .withFlag('--sobjecttype', 'TraceFlag')
      .withFlag(
        '--values',
        `tracedentityid='${data.id}' logtype=developer_log debuglevelid=${developerLogTraceFlag.getDebugLevelId()}`
      )
      .withArg('--usetoolingapi')
      .build();
  }

  public async execute(
    response: ContinueResponse<{ id: string }>
  ): Promise<void> {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;
    response.data.id = await getUserId(vscode.workspace.rootPath!);
    const execution = new CliCommandExecutor(this.build(response.data), {
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
      .withDescription('')
      .withArg('force:data:record:update')
      .withFlag('--sobjecttype', 'DebugLevel')
      .withFlag('--sobjectid', developerLogTraceFlag.getDebugLevelId())
      .withFlag('--values', 'ApexCode=Finest Visualforce=Finest')
      .withArg('--usetoolingapi')
      .build();
  }

  public execute(response: ContinueResponse<{}>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    channelService.streamCommandOutput(execution);
    channelService.showChannelOutput();
    CancellableStatusBar.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
    execution.processExitSubject.subscribe(async data => {
      if (data != undefined && data.toString() === '0') {
        showTraceFlagExpiration(
          developerLogTraceFlag.getExpirationDate().toLocaleString()
        );
      }
    });
  }
}

export class UpdateTraceFlagsExecutor extends SfdxCommandletExecutor<{}> {
  public build(data: {}): Command {
    return new SfdxCommandBuilder()
      .withDescription('')
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
      .build();
  }

  public execute(response: ContinueResponse<{}>): void {
    const cancellationTokenSource = new vscode.CancellationTokenSource();
    const cancellationToken = cancellationTokenSource.token;

    const execution = new CliCommandExecutor(this.build(response.data), {
      cwd: vscode.workspace.rootPath
    }).execute(cancellationToken);

    channelService.streamCommandOutput(execution);
    channelService.showChannelOutput();
    CancellableStatusBar.show(execution, cancellationTokenSource);
    taskViewService.addCommandExecution(execution, cancellationTokenSource);
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export function forceStartApexDebugLogging() {
  // tslint:disable-next-line:no-invalid-this
  const executor = new ForceStartApexDebugLoggingExecutor();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  commandlet.run();
}
