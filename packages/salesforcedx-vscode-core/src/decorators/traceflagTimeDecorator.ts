/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { optionHHmm, optionMMddYYYY } from '@salesforce/salesforcedx-utils-vscode';
import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { APEX_CODE_DEBUG_LEVEL } from '../constants';
import { nls } from '../messages';

let statusBarItem: StatusBarItem | undefined;

export const showTraceFlagExpiration = (expirationDate: Date): void => {
  statusBarItem ??= window.createStatusBarItem(StatusBarAlignment.Left, 40);
  const expirationHHmm = expirationDate.toLocaleTimeString(undefined, optionHHmm);
  statusBarItem.text = nls.localize('apex_debug_log_status_bar_text', expirationHHmm);

  statusBarItem.tooltip = nls.localize(
    'apex_debug_log_status_bar_hover_text',
    APEX_CODE_DEBUG_LEVEL,
    expirationHHmm,
    expirationDate.toLocaleDateString(undefined, optionMMddYYYY)
  );
  statusBarItem.show();
};

export const disposeTraceFlagExpiration = (): void => {
  statusBarItem?.dispose();
  statusBarItem = undefined; // Resetting to undefined to allow re-creation
};
