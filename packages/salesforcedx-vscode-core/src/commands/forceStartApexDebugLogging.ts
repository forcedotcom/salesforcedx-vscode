/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CliCommandExecutor,
  Command,
  CommandBuilder,
  CommandExecution,
  CommandOutput,
  CompositeCliCommandExecutor,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { APEX_CODE_DEBUG_LEVEL, VISUALFORCE_DEBUG_LEVEL } from '../constants';
import { nls } from '../messages';
import { getRootWorkspacePath, OrgAuthInfo } from '../util';
import {
  EmptyParametersGatherer,
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker
} from './util';

import { isNullOrUndefined } from 'util';
import { getDefaultUsernameOrAlias } from '../context';
import { telemetryService } from '../telemetry';
import { developerLogTraceFlag } from './';

export class ForceStartApexDebugLoggingExecutor extends SfdxCommandletExecutor<{}> {
  private cancellationTokenSource = new vscode.CancellationTokenSource();
  private cancellationToken = this.cancellationTokenSource.token;

  public build(): Command {
    return new CommandBuilder(nls.localize('force_start_apex_debug_logging'))
      .withLogName('force_start_apex_debug_logging')
      .build();
  }

  public attachSubExecution(execution: CommandExecution) {
    channelService.streamCommandOutput(execution);
  }

  public async execute(response: ContinueResponse<{}>): Promise<void> {
    const startTime = process.hrtime();
    const executionWrapper = new CompositeCliCommandExecutor(
      this.build()
    ).execute(this.cancellationToken);
    this.attachExecution(
      executionWrapper,
      this.cancellationTokenSource,
      this.cancellationToken
    );

    executionWrapper.processExitSubject.subscribe(() => {
      this.logMetric(executionWrapper.command.logName, startTime);
    });

    try {
      // query traceflag
      const userId = await getUserId(getRootWorkspacePath());

      let resultJson = await this.subExecute(
        new ForceQueryTraceFlag().build(userId)
      );
      if (resultJson && resultJson.result && resultJson.result.size >= 1) {
        const traceflag = resultJson.result.records[0];
        developerLogTraceFlag.setTraceFlagDebugLevelInfo(
          traceflag.Id,
          traceflag.StartDate,
          traceflag.ExpirationDate,
          traceflag.DebugLevelId
        );
        if (!developerLogTraceFlag.isValidDebugLevelId()) {
          throw new Error(nls.localize('invalid_debug_level_id_error'));
        }
        await this.subExecute(new UpdateDebugLevelsExecutor().build());

        if (!developerLogTraceFlag.isValidDateLength()) {
          developerLogTraceFlag.validateDates();
          await this.subExecute(new UpdateTraceFlagsExecutor().build());
        }
      } else {
        resultJson = await this.subExecute(new CreateDebugLevel().build());
        if (resultJson) {
          const debugLevelId = resultJson.result.id;
          developerLogTraceFlag.setDebugLevelId(debugLevelId);

          developerLogTraceFlag.validateDates();
          resultJson = await this.subExecute(
            new CreateTraceFlag(userId).build()
          );
          developerLogTraceFlag.setTraceFlagId(resultJson.result.id);
        }
      }
      developerLogTraceFlag.turnOnLogging();
      executionWrapper.successfulExit();
    } catch (e) {
      executionWrapper.failureExit(e);
    }
  }

  private async subExecute(command: Command) {
    if (!this.cancellationToken.isCancellationRequested) {
      const execution = new CliCommandExecutor(command, {
        cwd: getRootWorkspacePath()
      }).execute(this.cancellationToken);
      this.attachSubExecution(execution);
      const resultPromise = new CommandOutput().getCmdResult(execution);
      const result = await resultPromise;
      return JSON.parse(result);
    }
  }
}

export async function getUserId(projectPath: string): Promise<string> {
  const defaultUsernameOrAlias = await getDefaultUsernameOrAlias();
  if (isNullOrUndefined(defaultUsernameOrAlias)) {
    const err = nls.localize('error_no_default_username');
    telemetryService.sendException('replay_debugger_undefined_username', err);
    throw new Error(err);
  }

  const username = await OrgAuthInfo.getUsername(defaultUsernameOrAlias);
  if (isNullOrUndefined(username)) {
    const err = nls.localize('error_no_default_username');
    telemetryService.sendException('replay_debugger_undefined_username', err);
    throw new Error(err);
  }

  const execution = new CliCommandExecutor(
    new ForceQueryUser(username).build(),
    {
      cwd: projectPath
    }
  ).execute();
  telemetryService.sendCommandEvent(execution.command.logName);
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  try {
    const orgInfo = JSON.parse(result).result.records[0].Id;
    return Promise.resolve(orgInfo);
  } catch (e) {
    return Promise.reject(result);
  }
}

export class ForceQueryUser extends SfdxCommandletExecutor<{}> {
  private username: string;
  public constructor(username: string) {
    super();
    this.username = username;
  }
  public build(): Command {
    return new SfdxCommandBuilder()
      .withArg('force:data:soql:query')
      .withFlag(
        '--query',
        `SELECT id FROM User WHERE username='${this.username}'`
      )
      .withJson()
      .withLogName('force_query_user')
      .build();
  }
}

export class CreateDebugLevel extends SfdxCommandletExecutor<{}> {
  public readonly developerName = `ReplayDebuggerLevels${Date.now()}`;
  public build(): Command {
    return new SfdxCommandBuilder()
      .withArg('force:data:record:create')
      .withFlag('--sobjecttype', 'DebugLevel')
      .withFlag(
        '--values',
        `developername=${this.developerName} MasterLabel=${
          this.developerName
        } apexcode=${APEX_CODE_DEBUG_LEVEL} visualforce=${VISUALFORCE_DEBUG_LEVEL}`
      )
      .withArg('--usetoolingapi')
      .withJson()
      .withLogName('force_create_debug_level')
      .build();
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
      .withArg('force:data:record:create')
      .withFlag('--sobjecttype', 'TraceFlag')
      .withFlag(
        '--values',
        `tracedentityid='${
          this.userId
        }' logtype=developer_log debuglevelid=${developerLogTraceFlag.getDebugLevelId()} StartDate='' ExpirationDate='${developerLogTraceFlag
          .getExpirationDate()
          .toUTCString()}`
      )
      .withArg('--usetoolingapi')
      .withJson()
      .withLogName('force_create_trace_flag')
      .build();
  }
}

export class UpdateDebugLevelsExecutor extends SfdxCommandletExecutor<{}> {
  public build(): Command {
    const nonNullDebugLevel = developerLogTraceFlag.getDebugLevelId()!;
    return new SfdxCommandBuilder()
      .withArg('force:data:record:update')
      .withFlag('--sobjecttype', 'DebugLevel')
      .withFlag('--sobjectid', nonNullDebugLevel)
      .withFlag(
        '--values',
        `ApexCode=${APEX_CODE_DEBUG_LEVEL} Visualforce=${VISUALFORCE_DEBUG_LEVEL}`
      )
      .withArg('--usetoolingapi')
      .withJson()
      .withLogName('force_update_debug_level')
      .build();
  }
}

export class UpdateTraceFlagsExecutor extends SfdxCommandletExecutor<{}> {
  public build(): Command {
    const nonNullTraceFlag = developerLogTraceFlag.getTraceFlagId()!;
    return new SfdxCommandBuilder()
      .withArg('force:data:record:update')
      .withFlag('--sobjecttype', 'TraceFlag')
      .withFlag('--sobjectid', nonNullTraceFlag)
      .withFlag(
        '--values',
        `StartDate='' ExpirationDate='${developerLogTraceFlag
          .getExpirationDate()
          .toUTCString()}'`
      )
      .withArg('--usetoolingapi')
      .withJson()
      .withLogName('force_update_trace_flag')
      .build();
  }
}

const workspaceChecker = new SfdxWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export class ForceQueryTraceFlag extends SfdxCommandletExecutor<{}> {
  public build(userId: string): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_start_apex_debug_logging'))
      .withArg('force:data:soql:query')
      .withFlag(
        '--query',
        `SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce FROM TraceFlag WHERE logtype='DEVELOPER_LOG' AND TracedEntityId='${userId}'`
      )
      .withArg('--usetoolingapi')
      .withJson()
      .withLogName('force_query_trace_flag')
      .build();
  }
}

export async function forceStartApexDebugLogging() {
  const executor = new ForceStartApexDebugLoggingExecutor();
  const commandlet = new SfdxCommandlet(
    workspaceChecker,
    parameterGatherer,
    executor
  );
  await commandlet.run();
}
