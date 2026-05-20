/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

const SECTION = 'salesforcedx-vscode-metadata.notifications';

export type CommandNotificationMode = 'off' | 'statusBar' | 'toast';

export type CommandKey =
  | 'SFDX: Deploy This Source to Org'
  | 'SFDX: Retrieve This Source from Org'
  | 'SFDX: Push Source to Default Org'
  | 'SFDX: Pull Source from Default Org'
  | 'SFDX: Deploy Source in Manifest to Org'
  | 'SFDX: Retrieve Source in Manifest from Org'
  | 'SFDX: Delete from Project and Org'
  | 'SFDX: Diff Source Against Org'
  | 'Deploy on Save';

const getCommandNotificationMode = (command: CommandKey): CommandNotificationMode =>
  vscode.workspace.getConfiguration(SECTION).get<CommandNotificationMode>(command, 'toast');

/** Mutable state for the transient status bar item, boxed in a const object to satisfy functional/no-let. */
const transientState: { item: vscode.StatusBarItem | undefined; timeout: ReturnType<typeof setTimeout> | undefined } = {
  item: undefined,
  timeout: undefined
};

const getTransientStatusBar = (): vscode.StatusBarItem => {
  if (!transientState.item) {
    transientState.item = vscode.window.createStatusBarItem(
      'sf-metadata-notifications',
      vscode.StatusBarAlignment.Left,
      44
    );
    transientState.item.name = 'Salesforce: Metadata Notifications';
  }
  return transientState.item;
};

/** Show a message in the status bar for 5 seconds, then clear it. */
const showTransientStatusBarMessage = (message: string): void => {
  const item = getTransientStatusBar();
  item.text = `$(check) ${message}`;
  item.show();
  if (transientState.timeout) clearTimeout(transientState.timeout);
  transientState.timeout = setTimeout(() => {
    item.hide();
  }, 5000);
};

/**
 * Show a success info message for a command, routing to toast or status bar based on
 * the command's notification mode. Does nothing when mode is 'off'.
 */
export const showSuccessNotification = (command: CommandKey, message: string): void => {
  const mode = getCommandNotificationMode(command);
  if (mode === 'statusBar') {
    showTransientStatusBarMessage(message);
  } else if (mode === 'toast') {
    void vscode.window.showInformationMessage(message);
  }
};

/** Returns the ProgressLocation to use for a command's progress notification. */
export const getProgressLocation = (command: CommandKey): vscode.ProgressLocation =>
  getCommandNotificationMode(command) === 'toast'
    ? vscode.ProgressLocation.Notification
    : vscode.ProgressLocation.Window;
