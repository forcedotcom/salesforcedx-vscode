/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';

const SECTION = 'salesforcedx-vscode-metadata';
const KEY = 'notificationMode';

export type NotificationMode = 'notification' | 'statusBar';

export const getNotificationMode = (): NotificationMode =>
  vscode.workspace.getConfiguration(SECTION).get<NotificationMode>(KEY, 'notification');

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
export const showTransientStatusBarMessage = (message: string): void => {
  const item = getTransientStatusBar();
  item.text = `$(check) ${message}`;
  item.show();
  if (transientState.timeout) clearTimeout(transientState.timeout);
  transientState.timeout = setTimeout(() => {
    item.hide();
  }, 5000);
};

/**
 * Show an information message as a toast or status bar message depending on
 * the current notificationMode setting.
 */
export const showInfoNotification = (message: string): void => {
  if (getNotificationMode() === 'statusBar') {
    showTransientStatusBarMessage(message);
  } else {
    void vscode.window.showInformationMessage(message);
  }
};
