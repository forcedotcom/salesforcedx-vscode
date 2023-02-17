/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { match } from 'assert';
import {
  Workbench
} from 'wdio-vscode-service';
import {
  pause
} from './miscellaneous';

export async function waitForNotificationToGoAway(workbench: Workbench, notificationMessage: string, durationInSeconds: number, matchExactString: boolean = true): Promise<void> {
  // Change timeout from seconds to milliseconds
  durationInSeconds *= 1000;

  await pause(5);
  const startDate = new Date();
  while (true) {
    const notificationWasFound = await notificationIsPresent(workbench, notificationMessage, matchExactString);
    if (!notificationWasFound) {
      return;
    }

    const currentDate = new Date();
    const secondsPassed = Math.abs(currentDate.getTime() - startDate.getTime()) / 1000;
    if (secondsPassed >= durationInSeconds) {
      throw new Error(`Exceeded time limit - notification "${notificationMessage}" is still present`);
    }
  }
}

export async function notificationIsPresent(workbench: Workbench, notificationMessage: string, matchExactString: boolean = true): Promise<boolean> {
  const notifications = await workbench.getNotifications();
  for (const notification of notifications) {
    const message = await notification.getMessage();
    if (matchExactString) {
      if (message === notificationMessage) {
        return true;
      }
    } else {
      if (message.startsWith(notificationMessage)) {
        return true;
      }
    }
  }

  return false;
}

export async function attemptToFindNotification(workbench: Workbench, notificationMessage: string, attempts: number): Promise<boolean> {
  while (attempts > 0) {
    if (await notificationIsPresent(workbench, notificationMessage)) {
      return true;
    }

    await pause(1);
    attempts--;
  }

  return false;
}

export async function dismissAllNotifications(): Promise<void> {
  const workbench = await browser.getWorkbench();
  await browser.waitUntil(async () => {
    const notifications = await workbench.getNotifications();
    for (const notification of notifications) {
        await notification.dismiss();
    }

    return !(await workbench.hasNotifications());
  });
}
