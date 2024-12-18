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
  ContinueResponse,
  SfCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { channelService } from '../channels';
import { APEX_CODE_DEBUG_LEVEL, VISUALFORCE_DEBUG_LEVEL } from '../constants';
import { workspaceContextUtils } from '../context';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { OrgAuthInfo, workspaceUtils } from '../util';
import { developerLogTraceFlag } from '.';
import { EmptyParametersGatherer, SfCommandlet, SfCommandletExecutor, SfWorkspaceChecker } from './util';

export class StartApexDebugLoggingExecutor extends SfCommandletExecutor<{}> {
  private cancellationTokenSource = new vscode.CancellationTokenSource();
  private cancellationToken = this.cancellationTokenSource.token;

  public build(): Command {
    return new CommandBuilder(nls.localize('start_apex_debug_logging')).withLogName('start_apex_debug_logging').build();
  }

  public attachSubExecution(execution: CommandExecution) {
    channelService.streamCommandOutput(execution);
  }

  public async execute(response: ContinueResponse<{}>): Promise<void> {
    const startTime = process.hrtime();
    const executionWrapper = new CompositeCliCommandExecutor(this.build()).execute(this.cancellationToken);
    this.attachExecution(executionWrapper, this.cancellationTokenSource, this.cancellationToken);

    executionWrapper.processExitSubject.subscribe(() => {
      this.logMetric(executionWrapper.command.logName, startTime);
    });

    try {
      // query traceflag
      const userId = await getUserId(workspaceUtils.getRootWorkspacePath());

      let resultJson = await this.subExecute(new QueryTraceFlag().build(userId));
      if (resultJson && resultJson.result && resultJson.result.totalSize >= 1) {
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
          resultJson = await this.subExecute(new CreateTraceFlag(userId).build());
          developerLogTraceFlag.setTraceFlagId(resultJson.result.id);
        }
      }
      developerLogTraceFlag.turnOnLogging();
      executionWrapper.successfulExit();
    } catch (e) {
      executionWrapper.failureExit(e as Error);
    }
  }

  private async subExecute(command: Command) {
    if (!this.cancellationToken.isCancellationRequested) {
      const execution = new CliCommandExecutor(command, {
        cwd: workspaceUtils.getRootWorkspacePath()
      }).execute(this.cancellationToken);
      this.attachSubExecution(execution);
      const resultPromise = new CommandOutput().getCmdResult(execution);
      const result = await resultPromise;
      return JSON.parse(result);
    }
  }
}

export const getUserId = async (projectPath: string): Promise<string> => {
  const targetOrgOrAlias = await workspaceContextUtils.getTargetOrgOrAlias();
  if (!targetOrgOrAlias) {
    const err = nls.localize('error_no_target_org');
    telemetryService.sendException('replay_debugger_undefined_username', err);
    throw new Error(err);
  }

  const username = await OrgAuthInfo.getUsername(targetOrgOrAlias);
  if (!username) {
    const err = nls.localize('error_no_target_org');
    telemetryService.sendException('replay_debugger_undefined_username', err);
    throw new Error(err);
  }

  const execution = new CliCommandExecutor(new QueryUser(username).build(), {
    cwd: projectPath
  }).execute();
  telemetryService.sendCommandEvent(execution.command.logName);
  const cmdOutput = new CommandOutput();
  const result = await cmdOutput.getCmdResult(execution);
  try {
    const orgInfo = JSON.parse(result).result.records[0].Id;
    return Promise.resolve(orgInfo);
  } catch (e) {
    return Promise.reject(result);
  }
};

export class QueryUser extends SfCommandletExecutor<{}> {
  private username: string;
  public constructor(username: string) {
    super();
    this.username = username;
  }
  public build(): Command {
    return new SfCommandBuilder()
      .withArg('data:query')
      .withFlag('--query', `SELECT id FROM User WHERE username='${this.username}'`)
      .withJson()
      .withLogName('query_user')
      .build();
  }
}

export class CreateDebugLevel extends SfCommandletExecutor<{}> {
  public readonly developerName = `ReplayDebuggerLevels${Date.now()}`;
  public build(): Command {
    return new SfCommandBuilder()
      .withArg('data:create:record')
      .withFlag('--sobject', 'DebugLevel')
      .withFlag(
        '--values',
        `developername=${this.developerName} MasterLabel=${this.developerName} apexcode=${APEX_CODE_DEBUG_LEVEL} visualforce=${VISUALFORCE_DEBUG_LEVEL}`
      )
      .withArg('--use-tooling-api')
      .withJson()
      .withLogName('create_debug_level')
      .build();
  }
}

export class CreateTraceFlag extends SfCommandletExecutor<{}> {
  private userId: string;

  public constructor(userId: string) {
    super();
    this.userId = userId;
  }

  public build(): Command {
    return new SfCommandBuilder()
      .withArg('data:create:record')
      .withFlag('--sobject', 'TraceFlag')
      .withFlag(
        '--values',
        `tracedentityid='${
          this.userId
        }' logtype=developer_log debuglevelid=${developerLogTraceFlag.getDebugLevelId()} StartDate='' ExpirationDate='${developerLogTraceFlag
          .getExpirationDate()
          .toUTCString()}`
      )
      .withArg('--use-tooling-api')
      .withJson()
      .withLogName('create_trace_flag')
      .build();
  }
}

export class UpdateDebugLevelsExecutor extends SfCommandletExecutor<{}> {
  public build(): Command {
    const nonNullDebugLevel = developerLogTraceFlag.getDebugLevelId()!;
    return new SfCommandBuilder()
      .withArg('data:update:record')
      .withFlag('--sobject', 'DebugLevel')
      .withFlag('--record-id', nonNullDebugLevel)
      .withFlag('--values', `ApexCode=${APEX_CODE_DEBUG_LEVEL} Visualforce=${VISUALFORCE_DEBUG_LEVEL}`)
      .withArg('--use-tooling-api')
      .withJson()
      .withLogName('update_debug_level')
      .build();
  }
}

export class UpdateTraceFlagsExecutor extends SfCommandletExecutor<{}> {
  public build(): Command {
    const nonNullTraceFlag = developerLogTraceFlag.getTraceFlagId()!;
    return new SfCommandBuilder()
      .withArg('data:update:record')
      .withFlag('--sobject', 'TraceFlag')
      .withFlag('--record-id', nonNullTraceFlag)
      .withFlag('--values', `StartDate='' ExpirationDate='${developerLogTraceFlag.getExpirationDate().toUTCString()}'`)
      .withArg('--use-tooling-api')
      .withJson()
      .withLogName('update_trace_flag')
      .build();
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new EmptyParametersGatherer();

export class QueryTraceFlag extends SfCommandletExecutor<{}> {
  public build(userId: string): Command {
    return new SfCommandBuilder()
      .withDescription(nls.localize('start_apex_debug_logging'))
      .withArg('data:query')
      .withFlag(
        '--query',
        `SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce FROM TraceFlag WHERE logtype='DEVELOPER_LOG' AND TracedEntityId='${userId}'`
      )
      .withArg('--use-tooling-api')
      .withJson()
      .withLogName('query_trace_flag')
      .build();
  }
}

export const startApexDebugLogging = async (): Promise<void> => {
  const executor = new StartApexDebugLoggingExecutor();
  const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);
  await commandlet.run();
};
