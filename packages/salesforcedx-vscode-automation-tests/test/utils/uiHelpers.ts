/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { log } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { Workbench } from 'vscode-extension-tester';

/**
 * Dismisses all notifications using the notifications button in the status bar
 * @param workbench - The VSCode workbench instance
 * @param logPrefix - Optional prefix for log messages (e.g., 'Deploy:', 'Retrieve:')
 */
export const dismissAllNotifications = async (workbench: Workbench, logPrefix = ''): Promise<void> => {
  const prefix = logPrefix ? `${logPrefix} ` : '';

  log(`${prefix}Getting status bar to dismiss notifications`);
  const statusBar = workbench.getStatusBar();
  const notificationsButton = await statusBar.getItem('Notifications');

  if (notificationsButton) {
    log(`${prefix}Found notifications button, clicking to dismiss`);
    await notificationsButton.click();
    const notificationsCenter = await workbench.openNotificationsCenter();
    await notificationsCenter.clearAllNotifications();
    log(`${prefix}Notifications cleared`);
  } else {
    log(`${prefix}No notifications button found`);
  }
};
