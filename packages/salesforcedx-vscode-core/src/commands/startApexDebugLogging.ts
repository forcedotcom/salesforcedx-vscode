/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { notificationService, TraceFlags } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { TRACE_FLAG_EXPIRATION_KEY } from '../constants';
import { WorkspaceContext } from '../context';
import { showTraceFlagExpiration } from '../decorators/traceflagTimeDecorator';
import { OrgAuthInfo } from '../util';
import { handleStartCommand, handleFinishCommand } from '../utils/channelUtils';

const command = 'start_apex_debug_logging';

export const turnOnLogging = async (extensionContext: vscode.ExtensionContext): Promise<void> => {
  handleStartCommand(command);

  const connection = await WorkspaceContext.getInstance().getConnection();

  // If an expired TraceFlag exists for the current user, delete it
  const traceFlags = new TraceFlags(connection);
  await traceFlags.deleteExpiredTraceFlags(await OrgAuthInfo.getUserId());

  try {
    const debugLevelResultId = await traceFlags.getOrCreateDebugLevel();
    const expirationDate = traceFlags.calculateExpirationDate(new Date());
    const traceFlag = {
      TracedEntityId: await OrgAuthInfo.getUserId(),
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
  } catch {
    const expirationDate = extensionContext.workspaceState.get<Date>(TRACE_FLAG_EXPIRATION_KEY);
    if (expirationDate) {
      const expirationDateValidated = new Date(expirationDate);
      await notificationService.showInformationMessage(`Trace flag already exists. It will expire at ${expirationDateValidated.toLocaleTimeString()}.`);
    }
  }
};
