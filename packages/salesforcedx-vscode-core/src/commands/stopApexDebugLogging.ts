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
  const userId = await traceFlags.getUserIdOrThrow();

  // Check if a TraceFlag already exists for the current user
  const myTraceFlag = await traceFlags.getTraceFlagForUser(userId);

  if (myTraceFlag?.Id) {
    await connection.tooling.delete('TraceFlag', myTraceFlag.Id);
    extensionContext.workspaceState.update(TRACE_FLAG_EXPIRATION_KEY, undefined);
    disposeTraceFlagExpiration();
    await handleFinishCommand(command, true);
  } else {
    await notificationService.showInformationMessage('No active trace flag found.');
  }
};
