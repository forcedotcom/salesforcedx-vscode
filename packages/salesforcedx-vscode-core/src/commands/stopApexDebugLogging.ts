/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ChannelService, notificationService, SettingsService, TraceFlagsRemover } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import { WorkspaceContext } from '../context';
import { telemetryService } from '../telemetry';
import { developerLogTraceFlag } from '.';
import { OUTPUT_CHANNEL } from '../channels';

export const turnOffLogging = async (): Promise<void> => {
  console.log('Enter turnOffLogging()');
  const channelService = new ChannelService(OUTPUT_CHANNEL);
  if (SettingsService.getEnableClearOutputBeforeEachCommand()) {
    channelService.clear();
  }
  if (developerLogTraceFlag.isActive()) {
    console.log('Developer log trace flag is active');
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'SFDX: Turn Off Apex Debug Log for Replay Debugger',
          cancellable: false
        },
        async progress => {
          progress.report({ message: 'Running...' });
          const nonNullTraceFlag = developerLogTraceFlag.getTraceFlagId()!;
          const connection = await WorkspaceContext.getInstance().getConnection();
          await TraceFlagsRemover.getInstance(connection).removeTraceFlag(nonNullTraceFlag);
          telemetryService.sendCommandEvent('stop_apex_debug_logging');
          return Promise.resolve();
        }
      );

      await notificationService.showInformationMessage(
        'SFDX: Turn Off Apex Debug Log for Replay Debugger successfully ran'
      );
    } catch (error) {
      console.error('Error in turnOffLogging(): ', error);
      telemetryService.sendException('stop_apex_debug_logging', error);
      return Promise.reject('Restoring the debug levels failed.');
    }
  } else {
    console.log('Developer log trace flag is not active');
    telemetryService.sendException('stop_apex_debug_logging', 'No active trace flag found.');
    return Promise.reject('No active trace flag found.');
  }
  console.log('Exit turnOffLogging()');
};
