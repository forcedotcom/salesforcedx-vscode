/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities'; // Assuming utilities is a module in your project

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function showNotification(message: string) {
  // await utilities.getBrowser().executeWorkbench(async (vscode, message) => {
  //   vscode.window.showInformationMessage(`${message}`);
  // }, message);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function showNotificationWithActions(message: string, ...actions: string[]) {
  // await browser
  //   .executeWorkbench(
  //     async (vscode, message, ...actions) => {
  //       vscode.window.showInformationMessage(`${message}`, ...actions);
  //     },
  //     message,
  //     ...actions
  //   )
  //   .then(() => {});
}

describe('Notifications', async () => {
  // Show a notification
  it('should show an info notification', async () => {
    await showNotification('Modify the file and retrieve again');
    const isPresent = await utilities.notificationIsPresentWithTimeout(
      /Modify the file and retrieve again/,
      utilities.Duration.seconds(2)
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(isPresent).to.equal(true);
    await utilities.dismissNotification(/Modify the file and retrieve again/);
    await utilities.pause(utilities.Duration.seconds(1));
    const isNotPresent = await utilities.notificationIsAbsentWithTimeout(
      /Modify the file and retrieve again/,
      utilities.Duration.seconds(1)
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(isNotPresent).to.equal(true);
    await utilities.pause(utilities.Duration.seconds(2));
  });
  it('should show a notification with two actions', async () => {
    await showNotificationWithActions('Choose an action:', 'A', 'B');
    const isPresent = await utilities.notificationIsPresentWithTimeout(
      /Choose an action:/,
      utilities.Duration.seconds(1)
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(isPresent).to.equal(true);
    await utilities.pause(utilities.Duration.seconds(1));

    await utilities.acceptNotification('Choose an action:', 'A', utilities.Duration.seconds(1));

    const isNotPresent = await utilities.notificationIsAbsentWithTimeout(
      /Choose an action:/,
      utilities.Duration.seconds(5)
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(isNotPresent).to.equal(true);
  });
});
