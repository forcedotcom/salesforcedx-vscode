/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigUtil, projectPaths } from '@salesforce/salesforcedx-utils-vscode';
// import * as fs from 'fs';
import { StatusBarAlignment, StatusBarItem, window, workspace } from 'vscode';
import { nls } from '../messages';

const CONFIG_FILE = projectPaths.sfdxProjectConfig();

let statusBarItem: StatusBarItem;

export async function showOrg() {
  if (!statusBarItem) {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 50);
    statusBarItem.tooltip = nls.localize('status_bar_open_org_tooltip');
    statusBarItem.command = 'sfdx.force.org.open';
    statusBarItem.show();
  }
  await displayDefaultUserName();
}

export async function monitorOrgConfigChanges() {
  const watcher = workspace.createFileSystemWatcher(CONFIG_FILE);
  await watcher.onDidChange(uri => {
    displayDefaultUserName().catch(err => console.error(err));
  });
  await watcher.onDidCreate(uri => {
    displayDefaultUserName().catch(err => console.error(err));
  });
}

async function displayDefaultUserName() {
  const defaultUsernameOrAlias = await ConfigUtil.getDefaultUsernameOrAlias();
  if (defaultUsernameOrAlias) {
    statusBarItem.text = `$(browser)`;
  }
}
