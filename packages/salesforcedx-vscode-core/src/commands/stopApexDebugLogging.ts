/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TraceFlagsRemover } from '@salesforce/salesforcedx-utils-vscode';
import { WorkspaceContext } from '../context';
import { telemetryService } from '../telemetry';
import { developerLogTraceFlag } from '.';

export const turnOffLogging = async (): Promise<void> => {
  if (developerLogTraceFlag.isActive()) {
    try {
      const nonNullTraceFlag = developerLogTraceFlag.getTraceFlagId()!;
      const connection = await WorkspaceContext.getInstance().getConnection();
      await TraceFlagsRemover.getInstance(connection).removeTraceFlag(nonNullTraceFlag);
      telemetryService.sendCommandEvent('stop_apex_debug_logging');
      return Promise.resolve();
    } catch {
      return Promise.reject('Restoring the debug levels failed.');
    }
  }
};
