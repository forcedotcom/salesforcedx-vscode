/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

export type CommandNotificationMode = 'off' | 'statusBar' | 'toast';

const transientItems = new Map<
  string,
  { item: vscode.StatusBarItem; timeout: ReturnType<typeof setTimeout> | undefined }
>();

const getTransientStatusBar = (statusBarId: string, statusBarName: string): vscode.StatusBarItem => {
  const existing = transientItems.get(statusBarId);
  if (existing) return existing.item;
  const item = vscode.window.createStatusBarItem(statusBarId, vscode.StatusBarAlignment.Left, 44);
  item.name = statusBarName;
  transientItems.set(statusBarId, { item, timeout: undefined });
  return item;
};

const showTransientStatusBarMessage = (statusBarId: string, statusBarName: string, message: string): void => {
  const item = getTransientStatusBar(statusBarId, statusBarName);
  item.text = `$(check) ${message}`;
  item.show();
  const state = transientItems.get(statusBarId)!;
  if (state.timeout) clearTimeout(state.timeout);
  state.timeout = setTimeout(() => {
    item.hide();
    state.timeout = undefined;
  }, 5000);
};

export type NotificationModeApi<CommandKey extends string> = {
  showSuccessNotification: (command: CommandKey, message: string) => void;
  getProgressLocation: (command: CommandKey) => vscode.ProgressLocation;
};

const COMMAND_LEVEL_KEY = 'commandLevelNotifications';
const EXTENSION_LEVEL_KEY = 'extensionLevelNotifications';
const GLOBAL_SECTION = 'salesforcedx-vscode-services';
const GLOBAL_KEY = 'notifications';

const inspectExplicit = (section: string, key: string): CommandNotificationMode | undefined => {
  const i = vscode.workspace.getConfiguration(section).inspect<CommandNotificationMode>(key);
  return i?.workspaceFolderValue ?? i?.workspaceValue ?? i?.globalValue;
};

/**
 * Creates a notification mode API bound to a specific extension's settings sections.
 *
 * @param extensionSection - VS Code config section for the extension (e.g. 'salesforcedx-vscode-metadata')
 * @param statusBarId - Unique VS Code status bar item ID
 * @param statusBarName - Human-readable status bar item name
 */
export const createNotificationMode = <CommandKey extends string>(
  extensionSection: string,
  statusBarId: string,
  statusBarName: string
): NotificationModeApi<CommandKey> => {
  const commandLevelSection = `${extensionSection}.${COMMAND_LEVEL_KEY}`;

  const getCommandNotificationMode = (command: CommandKey): CommandNotificationMode =>
    inspectExplicit(commandLevelSection, command) ??
    inspectExplicit(extensionSection, EXTENSION_LEVEL_KEY) ??
    vscode.workspace.getConfiguration(GLOBAL_SECTION).get<CommandNotificationMode>(GLOBAL_KEY, 'toast');

  return {
    showSuccessNotification: (command: CommandKey, message: string): void => {
      const mode = getCommandNotificationMode(command);
      if (mode === 'statusBar') {
        showTransientStatusBarMessage(statusBarId, statusBarName, message);
      } else if (mode === 'toast') {
        void vscode.window.showInformationMessage(message);
      }
    },
    getProgressLocation: (command: CommandKey): vscode.ProgressLocation =>
      getCommandNotificationMode(command) === 'toast'
        ? vscode.ProgressLocation.Notification
        : vscode.ProgressLocation.Window
  };
};
