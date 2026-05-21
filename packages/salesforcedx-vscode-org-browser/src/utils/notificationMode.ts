/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

const SECTION = 'salesforcedx-vscode-org-browser.commandLevelNotifications';
const EXTENSION_SECTION = 'salesforcedx-vscode-org-browser';
const EXTENSION_KEY = 'extensionLevelNotifications';
const GLOBAL_SECTION = 'salesforcedx-vscode-services';
const GLOBAL_KEY = 'notifications';
const STATUS_BAR_ID = 'sf-org-browser-notifications';
const STATUS_BAR_NAME = 'Salesforce: Org Browser Notifications';

export type CommandNotificationMode = 'off' | 'statusBar' | 'toast';

export type CommandKey = 'Retrieve Metadata';

const getCommandNotificationMode = (command: CommandKey): CommandNotificationMode => {
  const commandLevel = vscode.workspace.getConfiguration(SECTION).get<CommandNotificationMode>(command);
  if (commandLevel !== undefined) return commandLevel;
  const extensionLevel = vscode.workspace
    .getConfiguration(EXTENSION_SECTION)
    .get<CommandNotificationMode>(EXTENSION_KEY);
  if (extensionLevel !== undefined) return extensionLevel;
  return vscode.workspace.getConfiguration(GLOBAL_SECTION).get<CommandNotificationMode>(GLOBAL_KEY, 'toast');
};

const transientState: { item: vscode.StatusBarItem | undefined; timeout: ReturnType<typeof setTimeout> | undefined } = {
  item: undefined,
  timeout: undefined
};

const getTransientStatusBar = (): vscode.StatusBarItem => {
  if (!transientState.item) {
    transientState.item = vscode.window.createStatusBarItem(STATUS_BAR_ID, vscode.StatusBarAlignment.Left, 44);
    transientState.item.name = STATUS_BAR_NAME;
  }
  return transientState.item;
};

const showTransientStatusBarMessage = (message: string): void => {
  const item = getTransientStatusBar();
  item.text = `$(check) ${message}`;
  item.show();
  if (transientState.timeout) clearTimeout(transientState.timeout);
  transientState.timeout = setTimeout(() => {
    item.hide();
  }, 5000);
};

export const showSuccessNotification = (command: CommandKey, message: string): void => {
  const mode = getCommandNotificationMode(command);
  if (mode === 'statusBar') {
    showTransientStatusBarMessage(message);
  } else if (mode === 'toast') {
    void vscode.window.showInformationMessage(message);
  }
};

export const getProgressLocation = (command: CommandKey): vscode.ProgressLocation =>
  getCommandNotificationMode(command) === 'toast'
    ? vscode.ProgressLocation.Notification
    : vscode.ProgressLocation.Window;
