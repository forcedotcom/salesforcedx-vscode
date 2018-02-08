/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { nls } from './messages';

let statusBarItem: StatusBarItem;

export function showTraceFlagExpiration(expirationDate: String) {
  if (!statusBarItem) {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 40);
  }
  statusBarItem.text = nls.localize(
    'force_apex_debug_log_status_bar_text',
    expirationDate
  );
  statusBarItem.show();
}

export function hideTraceFlagExpiration() {
  statusBarItem.hide();
}

export function disposeTraceFlagExpiration() {
  statusBarItem.dispose();
}
