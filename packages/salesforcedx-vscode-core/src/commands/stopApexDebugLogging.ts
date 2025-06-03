/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { WorkspaceContext } from '../context';
import { disposeTraceFlagExpiration } from '../decorators/traceflagTimeDecorator';
import { handleStartCommand, handleFinishCommand } from '../utils/channelUtils';
import { developerLogTraceFlag } from '.';

const command = 'stop_apex_debug_logging';

export const turnOffLogging = async (): Promise<void> => {
  handleStartCommand(command);

  const connection = await WorkspaceContext.getInstance().getConnection();

  // Check if a DebugLevel with DeveloperName 'ReplayDebuggerLevels' already exists
  const replayDebuggerLevels = await connection.tooling.query(
    "SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce FROM TraceFlag WHERE logtype='DEVELOPER_LOG'"
  );
  const replayDebuggerLevelsExists = replayDebuggerLevels.records.length > 0;

  if (replayDebuggerLevelsExists) {
    try {
      const traceFlagId = typeof replayDebuggerLevels.records[0].Id === 'string'
        ? replayDebuggerLevels.records[0].Id
        : '';
      await connection.tooling.delete('TraceFlag', traceFlagId);
      developerLogTraceFlag.turnOffLogging();
      disposeTraceFlagExpiration();
      await handleFinishCommand(command, true);
    } catch (error) {
      console.error('Error in turnOffLogging(): ', error);
      await handleFinishCommand(command, false, error);
      throw new Error('Restoring the debug levels failed.');
    }
  } else { // TODO don't need an error here, just notify the user
    await handleFinishCommand(command, false, 'No active trace flag found.');
    throw new Error('No active trace flag found.');
  }
};
