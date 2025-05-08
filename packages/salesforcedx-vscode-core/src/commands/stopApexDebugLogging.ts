/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService, TraceFlagsRemover } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { WorkspaceContext } from '../context';
import { telemetryService } from '../telemetry';
import { handleStartCommand, handleFinishCommand } from '../utils/channelUtils';
import { developerLogTraceFlag } from '.';

const command = 'SFDX: Turn Off Apex Debug Log for Replay Debugger';

export const turnOffLogging = async (): Promise<void> => {
  console.log('Enter turnOffLogging()');
  const channelService = new ChannelService(OUTPUT_CHANNEL);
  handleStartCommand(channelService, command);

  if (developerLogTraceFlag.isActive()) {
    console.log('Developer log trace flag is active');
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: command,
          cancellable: false
        },
        async progress => {
          progress.report({ message: 'Running...' });
          const nonNullTraceFlag = developerLogTraceFlag.getTraceFlagId()!;
          const connection = await WorkspaceContext.getInstance().getConnection();
          await TraceFlagsRemover.getInstance(connection).removeTraceFlag(nonNullTraceFlag);
          telemetryService.sendCommandEvent('stop_apex_debug_logging');
        }
      );

      await handleFinishCommand(channelService, command, true);
    } catch (error) {
      console.error('Error in turnOffLogging(): ', error);
      telemetryService.sendException('stop_apex_debug_logging', error);
      await handleFinishCommand(channelService, command, false);
      throw new Error('Restoring the debug levels failed.');
    }
  } else {
    console.log('Developer log trace flag is not active');
    telemetryService.sendException('stop_apex_debug_logging', 'No active trace flag found.');
    await handleFinishCommand(channelService, command, false);
    throw new Error('No active trace flag found.');
  }
  console.log('Exit turnOffLogging()');
};
