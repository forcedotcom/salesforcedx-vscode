/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { channelService } from '../../channels';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { telemetryService } from '../../telemetry';
import { FunctionService } from './functionService';

const LOG_NAME = 'force_function_stop';

/**
 * Stop all running function containers.
 * Currently, we don't support stopping individual containers,
 * because we don't support running multiple containers.
 */
export const forceFunctionStop = async () => {
  const startTime = process.hrtime();

  if (FunctionService.instance.isFunctionStarted()) {
    channelService.appendLine(nls.localize('force_function_stop_in_progress'));
    await FunctionService.instance.stopFunction();
    void notificationService
      .showSuccessfulExecution(nls.localize('force_function_stop_text'))
      .catch(() => { });
    telemetryService.sendCommandEvent(LOG_NAME, startTime, {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      language: FunctionService.instance.getFunctionLanguage()
    });
  } else {
    void notificationService.showWarningMessage(
      nls.localize('force_function_stop_not_started')
    );
  }
};
