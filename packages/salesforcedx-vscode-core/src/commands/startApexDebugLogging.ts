/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  notificationService,
  TraceFlags,
  showTraceFlagExpiration,
  getTraceFlagExpirationKey
} from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { WorkspaceContext } from '../context';
import { handleStartCommand, handleFinishCommand } from '../utils/channelUtils';

const command = 'start_apex_debug_logging';

export const turnOnLogging = async (extensionContext: vscode.ExtensionContext): Promise<void> => {
  handleStartCommand(command);

  const traceFlags = new TraceFlags(await WorkspaceContext.getInstance().getConnection());

  const userId = await traceFlags.getUserIdOrThrow();

  // If an expired TraceFlag exists for the current user, delete it
  await traceFlags.deleteExpiredTraceFlags(userId);

  // Get user-specific key for storing expiration date
  const userSpecificKey = getTraceFlagExpirationKey(userId);

  try {
    const debugLevelResultId = await traceFlags.getOrCreateDebugLevel();
    const expirationDate = traceFlags.calculateExpirationDate(new Date());
    await traceFlags.createTraceFlag(userId, debugLevelResultId, expirationDate);

    extensionContext.workspaceState.update(userSpecificKey, expirationDate);
    showTraceFlagExpiration(expirationDate);

    await handleFinishCommand(command, true);
  } catch {
    const expirationDate = extensionContext.workspaceState.get<Date>(userSpecificKey);
    if (expirationDate) {
      const expirationDateValidated = new Date(expirationDate);
      await notificationService.showInformationMessage(
        `Trace flag already exists. It will expire at ${expirationDateValidated.toLocaleTimeString()}.`
      );
    }
  }
};
