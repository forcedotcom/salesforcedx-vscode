/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Global } from '@salesforce/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StatusBarAlignment, StatusBarItem, window, workspace } from 'vscode';
import { SFDX_CONFIG_FILE } from '../constants';
import { nls } from '../messages';
import { getRootWorkspacePath, hasRootWorkspace } from '../util';

const CONFIG_FILE = hasRootWorkspace()
  ? path.join(
      getRootWorkspacePath(),
      Global.SFDX_STATE_FOLDER,
      SFDX_CONFIG_FILE
    )
  : path.join(os.homedir(), Global.SFDX_STATE_FOLDER, SFDX_CONFIG_FILE);

let statusBarItem: StatusBarItem;

export function showOrg() {
  if (!statusBarItem) {
    statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 50);
    statusBarItem.tooltip = nls.localize('status_bar_open_org_tooltip');
    statusBarItem.command = 'sfdx.force.org.open';
    statusBarItem.show();
  }
  displayDefaultUserName(CONFIG_FILE);
}

export function monitorOrgConfigChanges() {
  const watcher = workspace.createFileSystemWatcher(CONFIG_FILE);
  watcher.onDidChange(uri => {
    displayDefaultUserName(uri.fsPath);
  });
  watcher.onDidCreate(uri => {
    displayDefaultUserName(uri.fsPath);
  });
}

function displayDefaultUserName(configPath: string) {
  fs.readFile(configPath, (err, data) => {
    if (!err) {
      const config = JSON.parse(data.toString());
      if (config['defaultusername']) {
        statusBarItem.text = `$(browser)`;
      }
    }
  });
}
