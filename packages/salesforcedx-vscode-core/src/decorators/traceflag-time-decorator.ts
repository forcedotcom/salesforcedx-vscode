/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { optionHHmm, optionMMddYYYY } from '@salesforce/salesforcedx-utils-vscode';
import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { APEX_CODE_DEBUG_LEVEL } from './../constants';
import { nls } from './../messages';

let statusBarItem: StatusBarItem;

export const showTraceFlagExpiration = (expirationDate: Date): void => {
  if (!statusBarItem) {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 40);
  }

  statusBarItem.text = nls.localize(
    'apex_debug_log_status_bar_text',
    expirationDate.toLocaleTimeString(undefined, optionHHmm)
  );

  statusBarItem.tooltip = nls.localize(
    'apex_debug_log_status_bar_hover_text',
    APEX_CODE_DEBUG_LEVEL,
    expirationDate.toLocaleTimeString(undefined, optionHHmm),
    expirationDate.toLocaleDateString(undefined, optionMMddYYYY)
  );
  statusBarItem.show();
};

export const hideTraceFlagExpiration = (): void => {
  statusBarItem.hide();
};

export const disposeTraceFlagExpiration = (): void => {
  statusBarItem.dispose();
};
