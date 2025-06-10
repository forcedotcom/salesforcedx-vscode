/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core-bundle';
import * as vscode from 'vscode';
import { APEX_CODE_DEBUG_LEVEL, TRACE_FLAG_EXPIRATION_KEY, VISUALFORCE_DEBUG_LEVEL } from '../constants';
import { WorkspaceContext, workspaceContextUtils } from '../context';
import { showTraceFlagExpiration } from '../decorators/traceflagTimeDecorator';
import { nls } from '../messages';
import { telemetryService } from '../telemetry';
import { OrgAuthInfo } from '../util';
import { handleStartCommand, handleFinishCommand } from '../utils/channelUtils';

const command = 'start_apex_debug_logging';

export const turnOnLogging = async (extensionContext: vscode.ExtensionContext): Promise<void> => {
  handleStartCommand(command);

  try {
    const connection = await WorkspaceContext.getInstance().getConnection();

    // If an expired TraceFlag exists for the current user, delete it
    const traceFlags = await connection.tooling.query(
      `SELECT Id, ExpirationDate FROM TraceFlag WHERE LogType = 'DEVELOPER_LOG' AND TracedEntityId = '${await getUserId(connection)}'`
    );
    console.log(JSON.stringify(traceFlags, null, 2));
    const currentTime = new Date();
    const expiredTraceFlagExists = traceFlags.records.filter(
      (flag: any) => flag.ExpirationDate && new Date(flag.ExpirationDate) < currentTime
    ).length > 0;

    if (expiredTraceFlagExists) {
      const traceFlagId = typeof traceFlags.records[0].Id === 'string'
        ? traceFlags.records[0].Id
        : '';
      await connection.tooling.delete('TraceFlag', traceFlagId);
    }

    // Check if a DebugLevel with DeveloperName 'ReplayDebuggerLevels' already exists
    const replayDebuggerLevels = await connection.tooling.query(
      "SELECT Id FROM DebugLevel WHERE DeveloperName = 'ReplayDebuggerLevels' LIMIT 1"
    );
    const replayDebuggerLevelsExists = replayDebuggerLevels.records.length > 0;
    let debugLevelResultId = replayDebuggerLevels.records[0]?.Id;

    if (!replayDebuggerLevelsExists) {
      // Create a new DebugLevel
      const debugLevel = {
        DeveloperName: 'ReplayDebuggerLevels',
        MasterLabel: 'ReplayDebuggerLevels',
        ApexCode: APEX_CODE_DEBUG_LEVEL,
        Visualforce: VISUALFORCE_DEBUG_LEVEL
      };
      const debugLevelResult = await connection.tooling.create('DebugLevel', debugLevel);
      if (!debugLevelResult.success) {
        throw new Error('Failed to create debug level');
      }
      debugLevelResultId = debugLevelResult.id;
    }

    const expirationDate = new Date(currentTime.getTime() + 30 * 60 * 1000); // 30 minutes from now
    const traceFlag = {
      TracedEntityId: await getUserId(connection),
      LogType: 'DEVELOPER_LOG',
      ExpirationDate: expirationDate.toUTCString(),
      DebugLevelId: debugLevelResultId
    };

    const traceFlagResult = await connection.tooling.create('TraceFlag', traceFlag);
    if (!traceFlagResult.success) {
      throw new Error('Failed to create trace flag');
    }

    extensionContext.workspaceState.update(TRACE_FLAG_EXPIRATION_KEY, expirationDate);
    showTraceFlagExpiration(expirationDate);

    await handleFinishCommand(command, true);
  } catch (error) {
    console.error(error);
    await handleFinishCommand(command, false, 'Trace flag for Apex Replay Debugger already exists.');
    throw new Error('Trace flag for Apex Replay Debugger already exists.');
  }
};

export const getUserId = async (connection: Connection): Promise<string> => {
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

  const result = await connection.singleRecordQuery<{ Id: string }>(`SELECT Id FROM User WHERE Username = '${username}'`);
  return result.Id;
};
