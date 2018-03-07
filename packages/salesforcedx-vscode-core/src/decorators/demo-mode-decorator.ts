/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { nls } from '../../src/messages';

let demoModeStatusBar: StatusBarItem;

export function showDemoMode() {
  if (!demoModeStatusBar) {
    demoModeStatusBar = window.createStatusBarItem(
      StatusBarAlignment.Right,
      50
    );
    demoModeStatusBar.text = nls.localize('demo_mode_status_text');
    demoModeStatusBar.tooltip = nls.localize('demo_mode_status_tooltip');
    demoModeStatusBar.show();
  }
}
