/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil, projectPaths } from '@salesforce/salesforcedx-utils-vscode';
import { StatusBarAlignment, StatusBarItem, window, workspace } from 'vscode';
import { ORG_OPEN_COMMAND } from '../../src';
import { nls } from '../messages';

const CONFIG_FILE = projectPaths.sfdxProjectConfig();

let statusBarItem: StatusBarItem;

export async function showOrg() {
  await displayBrowserIcon();
}

export function monitorOrgConfigChanges() {
  const watcher = workspace.createFileSystemWatcher(CONFIG_FILE);
  watcher.onDidChange(() => {
    displayBrowserIcon().catch(err => console.error(err));
  });
  watcher.onDidCreate(() => {
    displayBrowserIcon().catch(err => console.error(err));
  });
}

async function displayBrowserIcon() {
  const defaultUsernameOrAlias = await ConfigUtil.getDefaultUsernameOrAlias();
  if (defaultUsernameOrAlias) {
    if (!statusBarItem) {
      statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 50);
      statusBarItem.tooltip = nls.localize('status_bar_open_org_tooltip');
      statusBarItem.command = ORG_OPEN_COMMAND;
      statusBarItem.show();
    }
    statusBarItem.text = `$(browser)`;
  }
}
