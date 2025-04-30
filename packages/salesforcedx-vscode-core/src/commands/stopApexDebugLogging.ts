/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TraceFlagsRemover } from '@salesforce/salesforcedx-utils-vscode';
import { telemetryService } from '../telemetry';
import { developerLogTraceFlag } from '.';
import { WorkspaceContext } from '../context';

export const turnOffLogging = async (): Promise<void> => {
  if (developerLogTraceFlag.isActive()) {
    try {
      await deleteTraceFlag();
      telemetryService.sendCommandEvent('stop_apex_debug_logging');
      return Promise.resolve();
    } catch (e) {
      return Promise.reject('Restoring the debug levels failed.');
    }
  }
};

const deleteTraceFlag = async (): Promise<void> => {
  console.log('Enter deleteTraceFlag()');
  const nonNullTraceFlag = developerLogTraceFlag.getTraceFlagId()!;
  const connection = await WorkspaceContext.getInstance().getConnection();
  await TraceFlagsRemover.getInstance(connection).removeTraceFlag(nonNullTraceFlag);
  console.log('Exit deleteTraceFlag()');
};
