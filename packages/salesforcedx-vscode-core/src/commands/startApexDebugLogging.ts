/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CliCommandExecutor, CommandOutput } from '@salesforce/salesforcedx-utils';
import { APEX_CODE_DEBUG_LEVEL, VISUALFORCE_DEBUG_LEVEL } from '../constants';
import { WorkspaceContext, workspaceContextUtils } from '../context';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { OrgAuthInfo } from '../util';
import { handleStartCommand, handleFinishCommand } from '../utils/channelUtils';
import { developerLogTraceFlag } from '.';
import { QueryUser } from './startApexDebugLoggingOld';
import { workspaceUtils } from '@salesforce/salesforcedx-utils-vscode';

const command = 'start_apex_debug_logging';

// const generateTraceFlagId = (): string => {
//   const timestamp = Date.now().toString();
//   const random = Math.floor(Math.random() * 1000)
//     .toString()
//     .padStart(3, '0');
//   return `7tf${timestamp}${random}`;
// };

export const turnOnLogging = async (): Promise<void> => {
  handleStartCommand(command);

  try {
    const connection = await WorkspaceContext.getInstance().getConnection();

    // Create a new DebugLevel first
    const debugLevel = {
      DeveloperName: `ReplayDebuggerLevels${Date.now()}`,
      MasterLabel: `ReplayDebuggerLevels${Date.now()}`,
      ApexCode: APEX_CODE_DEBUG_LEVEL,
      Visualforce: VISUALFORCE_DEBUG_LEVEL
    };
    const debugLevelResult = await connection.tooling.create('DebugLevel', debugLevel);
    if (!debugLevelResult.success) {
      throw new Error('Failed to create debug level');
    }

    // const traceFlag = {
    //   // TracedEntityId: generateTraceFlagId(),
    //   TracedEntityId: await getUserId(workspaceUtils.getRootWorkspacePath()),
    //   LogType: 'DEVELOPER_LOG',
    //   StartDate: developerLogTraceFlag.getStartDate().toISOString(),
    //   ExpirationDate: developerLogTraceFlag.getExpirationDate().toISOString(),
    //   DebugLevelId: debugLevelResult.id
    // };
    const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const traceFlag = {
      TracedEntityId: await getUserId(workspaceUtils.getRootWorkspacePath()),
      LogType: 'DEVELOPER_LOG',
      StartDate: '', // Empty string, as in CLI
      ExpirationDate: expirationDate.toUTCString(), // RFC1123 format
      DebugLevelId: debugLevelResult.id
    };
    console.log('TraceFlag object:', JSON.stringify(traceFlag, null, 2));

    const traceFlagResult = await connection.tooling.create('TraceFlag', traceFlag);
    if (!traceFlagResult.success) {
      throw new Error('Failed to create trace flag');
    }

    developerLogTraceFlag.setTraceFlagId(traceFlagResult.id);
    developerLogTraceFlag.setDebugLevelId(debugLevelResult.id);
    developerLogTraceFlag.turnOnLogging();

    await handleFinishCommand(command, true);
  } catch (error) {
    console.error(error);
    await handleFinishCommand(command, false, 'Cannot create trace flag.');
    throw new Error('Cannot create trace flag.');
  }
};

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
  } catch {
    return Promise.reject(result);
  }
};
