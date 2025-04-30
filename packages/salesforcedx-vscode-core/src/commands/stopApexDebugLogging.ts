/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CancelResponse, ContinueResponse, ParametersGatherer, TraceFlagsRemover } from '@salesforce/salesforcedx-utils-vscode';
import { hideTraceFlagExpiration } from '../decorators';
import { telemetryService } from '../telemetry';
import { developerLogTraceFlag } from '.';
import { SfCommandlet, SfWorkspaceChecker } from './util';
import { WorkspaceContext } from '../context';

export class StopApexDebugLoggingExecutor {
  public execute(response: ContinueResponse<{}>): void {
    console.log('Enter execute()');
    const startTime = process.hrtime();

    void (async () => {
      try {
        console.log('Enter try block');
        await deleteTraceFlag();
        developerLogTraceFlag.turnOffLogging();
        hideTraceFlagExpiration();
        telemetryService.sendCommandEvent('stop_apex_debug_logging', startTime);
      } catch (error) {
        console.log('Enter catch block');
        telemetryService.sendException('stop_apex_debug_logging', error);
      }
      console.log('Exit execute()');
    })();
  }
}

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

class ActiveLogging implements ParametersGatherer<{}> {
  public async gather(): Promise<CancelResponse | ContinueResponse<{}>> {
    console.log('Enter gather()');
    console.log('developerLogTraceFlag.isActive()', developerLogTraceFlag.isActive());
    if (developerLogTraceFlag.isActive()) {
      return { type: 'CONTINUE', data: {} };
    }
    return { type: 'CANCEL' };
  }
}

const workspaceChecker = new SfWorkspaceChecker();
const parameterGatherer = new ActiveLogging();
const executor = new StopApexDebugLoggingExecutor();
const commandlet = new SfCommandlet(workspaceChecker, parameterGatherer, executor);

export const stopApexDebugLogging = async (): Promise<void> => {
  await commandlet.run();
};
