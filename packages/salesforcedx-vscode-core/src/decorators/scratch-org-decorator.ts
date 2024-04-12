/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil } from '@salesforce/salesforcedx-utils-vscode';
import { StatusBarAlignment, StatusBarItem, window } from 'vscode';
import { ORG_OPEN_COMMAND } from '../../src/constants';
import { nls } from '../messages';

let statusBarItem: StatusBarItem | undefined;

export async function showOrg() {
  await displayBrowserIcon();
}

async function displayBrowserIcon() {
  const targetOrgOrAlias = await ConfigUtil.getTargetOrgOrAlias();
  if (targetOrgOrAlias) {
    if (!statusBarItem) {
      statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 50);
      statusBarItem.tooltip = nls.localize('status_bar_open_org_tooltip');
      statusBarItem.command = ORG_OPEN_COMMAND;
      statusBarItem.show();
    }
    statusBarItem.text = '$(browser)';
  } else if (!targetOrgOrAlias && statusBarItem) {
    statusBarItem.dispose();
    statusBarItem = undefined;
  }
}
