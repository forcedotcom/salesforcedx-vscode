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

const logName = 'force_function_stop';

/**
 * Stop all running function containers.
 * Currently, we don't support stopping individual container,
 * because we don't support running multiple containers.
 */
export async function forceFunctionStop() {
  const startTime = process.hrtime();

  if (FunctionService.instance.isFunctionStarted()) {
    channelService.appendLine(nls.localize('force_function_stop_in_progress'));
    await FunctionService.instance.stopFunction();
    notificationService
      .showSuccessfulExecution(nls.localize('force_function_stop_text'))
      .catch(() => {});
    telemetryService.sendCommandEvent(logName, startTime);
  } else {
    notificationService.showWarningMessage(
      nls.localize('force_function_stop_not_started')
    );
  }
}
