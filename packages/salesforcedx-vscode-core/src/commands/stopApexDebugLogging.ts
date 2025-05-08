/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ChannelService, TraceFlagsRemover } from '@salesforce/salesforcedx-utils-vscode';
import { OUTPUT_CHANNEL } from '../channels';
import { WorkspaceContext } from '../context';
import { handleStartCommand, handleFinishCommand } from '../utils/channelUtils';
import { developerLogTraceFlag } from '.';

const command = 'stop_apex_debug_logging';

export const turnOffLogging = async (): Promise<void> => {
  console.log('Enter turnOffLogging()');
  const channelService = new ChannelService(OUTPUT_CHANNEL);
  handleStartCommand(channelService, command);

  if (developerLogTraceFlag.isActive()) {
    console.log('Developer log trace flag is active');
    try {
      const nonNullTraceFlag = developerLogTraceFlag.getTraceFlagId()!;
      const connection = await WorkspaceContext.getInstance().getConnection();
      await TraceFlagsRemover.getInstance(connection).removeTraceFlag(nonNullTraceFlag);
      await handleFinishCommand(channelService, command, true);
    } catch (error) {
      console.error('Error in turnOffLogging(): ', error);
      await handleFinishCommand(channelService, command, false, error);
      throw new Error('Restoring the debug levels failed.');
    }
  } else {
    console.log('Developer log trace flag is not active');
    await handleFinishCommand(channelService, command, false, 'No active trace flag found.');
    throw new Error('No active trace flag found.');
  }
  console.log('Exit turnOffLogging()');
};
