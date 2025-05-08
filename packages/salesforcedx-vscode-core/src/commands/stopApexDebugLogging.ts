/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TraceFlagsRemover } from '@salesforce/salesforcedx-utils-vscode';
import { WorkspaceContext } from '../context';
import { handleStartCommand, handleFinishCommand } from '../utils/channelUtils';
import { developerLogTraceFlag } from '.';

const command = 'stop_apex_debug_logging';

export const turnOffLogging = async (): Promise<void> => {
  handleStartCommand(command);

  if (developerLogTraceFlag.isActive()) {
    try {
      const nonNullTraceFlag = developerLogTraceFlag.getTraceFlagId()!;
      const connection = await WorkspaceContext.getInstance().getConnection();
      await TraceFlagsRemover.getInstance(connection).removeTraceFlag(nonNullTraceFlag);
      await handleFinishCommand(command, true);
    } catch (error) {
      console.error('Error in turnOffLogging(): ', error);
      await handleFinishCommand(command, false, error);
      throw new Error('Restoring the debug levels failed.');
    }
  } else {
    await handleFinishCommand(command, false, 'No active trace flag found.');
    throw new Error('No active trace flag found.');
  }
};
