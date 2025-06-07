/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { notificationService } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { TRACE_FLAG_EXPIRATION_KEY } from '../constants';
import { WorkspaceContext } from '../context';
import { disposeTraceFlagExpiration } from '../decorators/traceflagTimeDecorator';
import { handleStartCommand, handleFinishCommand } from '../utils/channelUtils';

const command = 'stop_apex_debug_logging';

export const turnOffLogging = async (extensionContext: vscode.ExtensionContext): Promise<void> => {
  handleStartCommand(command);

  const connection = await WorkspaceContext.getInstance().getConnection();

  // Check if a TraceFlag already exists
  const traceFlags = await connection.tooling.query(
    "SELECT id FROM TraceFlag WHERE logtype='DEVELOPER_LOG'"
  );
  const traceFlagExists = traceFlags.records.length > 0;

  if (traceFlagExists) {
    const traceFlagId = typeof traceFlags.records[0].Id === 'string'
      ? traceFlags.records[0].Id
      : '';
    await connection.tooling.delete('TraceFlag', traceFlagId);
    extensionContext.workspaceState.update(TRACE_FLAG_EXPIRATION_KEY, undefined);
    disposeTraceFlagExpiration();
    await handleFinishCommand(command, true);
  } else {
    await notificationService.showInformationMessage('No active trace flag found.');
  }
};
