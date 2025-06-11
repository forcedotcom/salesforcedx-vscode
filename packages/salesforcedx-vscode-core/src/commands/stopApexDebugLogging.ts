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
import { disposeTraceFlagExpiration } from '../decorators/traceflagTimeDecorator';
import { handleStartCommand, handleFinishCommand } from '../utils/channelUtils';

const command = 'stop_apex_debug_logging';

export const turnOffLogging = async (extensionContext: vscode.ExtensionContext): Promise<void> => {
  handleStartCommand(command);

  const connection = await WorkspaceContext.getInstance().getConnection();

  const traceFlags = new TraceFlags(connection);
  const username = connection.getUsername();
  if (!username) {
    throw new Error('No username found for the current connection.');
  }
  const userId = await traceFlags.getUserIdOrThrow(username);

  // Check if a TraceFlag already exists for the current user
  const traceFlagsList = await connection.tooling.query(
    `SELECT Id, ExpirationDate FROM TraceFlag WHERE LogType = 'DEVELOPER_LOG' AND TracedEntityId = '${userId}'`
  );
  const [firstTraceFlag] = traceFlagsList.records;

  if (firstTraceFlag?.Id) {
    await connection.tooling.delete('TraceFlag', firstTraceFlag.Id);
    extensionContext.workspaceState.update(TRACE_FLAG_EXPIRATION_KEY, undefined);
    disposeTraceFlagExpiration();
    await handleFinishCommand(command, true);
  } else {
    await notificationService.showInformationMessage('No active trace flag found.');
  }
};
