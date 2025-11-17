/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { OUTPUT_CHANNEL } from './channels';
import {
  configSet,
  orgCreate,
  orgDelete,
  orgDisplay,
  orgList,
  orgLoginAccessToken,
  orgLoginWeb,
  orgLoginWebDevHub,
  orgLogoutAll,
  orgLogoutDefault,
  orgOpen
} from './commands';
import { ORG_OPEN_COMMAND } from './constants';
import { showOrg } from './decorators/orgDecorator';
import { OrgList } from './orgPicker/orgList';
import { setUpOrgExpirationWatcher } from './util/orgUtil';

/** Register all org/auth commands */
const registerCommands = (): vscode.Disposable =>
  vscode.Disposable.from(
    vscode.commands.registerCommand('sf.config.set', configSet),
    vscode.commands.registerCommand('sf.org.login.web', orgLoginWeb),
    vscode.commands.registerCommand('sf.org.login.access.token', orgLoginAccessToken),
    vscode.commands.registerCommand('sf.org.create', orgCreate),
    vscode.commands.registerCommand('sf.org.delete.default', orgDelete),
    vscode.commands.registerCommand('sf.org.delete.username', orgDelete, {
      flag: '--target-org'
    }),
    vscode.commands.registerCommand('sf.org.display.default', orgDisplay),
    vscode.commands.registerCommand('sf.org.display.username', orgDisplay, {
      flag: '--target-org'
    }),
    vscode.commands.registerCommand('sf.org.list.clean', orgList),
    vscode.commands.registerCommand('sf.org.login.web.dev.hub', orgLoginWebDevHub),
    vscode.commands.registerCommand('sf.org.logout.all', orgLogoutAll),
    vscode.commands.registerCommand('sf.org.logout.default', orgLogoutDefault),
    vscode.commands.registerCommand(ORG_OPEN_COMMAND, orgOpen)
  );

/** Register org picker commands */
const registerOrgPickerCommands = (orgListParam: OrgList): vscode.Disposable => {
  const setDefaultOrgCmd = vscode.commands.registerCommand('sf.set.default.org', () => orgListParam.setDefaultOrg());
  return vscode.Disposable.from(setDefaultOrgCmd);
};

/** Initialize org picker and org status bar */
const initializeOrgPicker = (extensionContext: vscode.ExtensionContext): void => {
  const orgListParam = new OrgList();
  extensionContext.subscriptions.push(orgListParam, registerOrgPickerCommands(orgListParam));

  // Set up org expiration watcher
  void setUpOrgExpirationWatcher(orgListParam);

  // Show org decorator in status bar
  void showOrg();
};

export const activate = (extensionContext: vscode.ExtensionContext): void => {
  console.log('Salesforce Org Management extension activated');

  // Register output channel
  extensionContext.subscriptions.push(OUTPUT_CHANNEL, registerCommands());

  // Initialize org picker and status bar
  initializeOrgPicker(extensionContext);
};

export const deactivate = (): void => {
  console.log('Salesforce Org Management extension deactivated');
};
