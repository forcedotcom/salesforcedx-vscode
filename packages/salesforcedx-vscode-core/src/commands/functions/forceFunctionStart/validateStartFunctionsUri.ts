/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Uri, window } from 'vscode';

import { notificationService } from '@salesforce/salesforcedx-utils-vscode';

import { nls } from '../../../messages';
import { telemetryService } from '../../../telemetry';

export const WARNING_MSG_KEY =
  'force_function_start_warning_not_in_function_folder';
export const NO_FUNCTION_FOLDER_KEY =
  'force_function_start_not_in_function_folder';

export const validateStartFunctionsUri = (sourceUri?: Uri): Uri | undefined => {
  if (!sourceUri) {
    // Try to start function from current active editor, if running SFDX: start function from command palette
    sourceUri = window.activeTextEditor?.document.uri!;
  }
  if (!sourceUri) {
    const warningMessage = nls.localize(WARNING_MSG_KEY);
    notificationService.showWarningMessage(warningMessage);
    telemetryService.sendException(NO_FUNCTION_FOLDER_KEY, warningMessage);
    return;
  }

  return sourceUri;
};
