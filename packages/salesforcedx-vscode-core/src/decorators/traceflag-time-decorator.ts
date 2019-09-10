/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { APEX_CODE_DEBUG_LEVEL } from './../constants';
import { nls } from './../messages';

let statusBarItem: StatusBarItem;

export function showTraceFlagExpiration(expirationDate: Date) {
  if (!statusBarItem) {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 40);
  }

  statusBarItem.text = nls.localize(
    'force_apex_debug_log_status_bar_text',
    expirationDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    })
  );

  statusBarItem.tooltip = nls.localize(
    'force_apex_debug_log_status_bar_hover_text',
    APEX_CODE_DEBUG_LEVEL,
    expirationDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    }),
    expirationDate.toLocaleDateString(undefined, {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  );
  statusBarItem.show();
}

export function hideTraceFlagExpiration() {
  statusBarItem.hide();
}

export function disposeTraceFlagExpiration() {
  statusBarItem.dispose();
}
