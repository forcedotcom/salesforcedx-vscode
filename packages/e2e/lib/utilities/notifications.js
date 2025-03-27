"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.waitForNotificationToGoAway = waitForNotificationToGoAway;
exports.notificationIsPresent = notificationIsPresent;
exports.notificationIsPresentWithTimeout = notificationIsPresentWithTimeout;
exports.notificationIsAbsent = notificationIsAbsent;
exports.notificationIsAbsentWithTimeout = notificationIsAbsentWithTimeout;
exports.dismissNotification = dismissNotification;
exports.acceptNotification = acceptNotification;
exports.dismissAllNotifications = dismissAllNotifications;
const miscellaneous_1 = require("./miscellaneous");
const workbench_1 = require("./workbench");
const commandPrompt_1 = require("./commandPrompt");
const vscode_extension_tester_1 = require("vscode-extension-tester");
async function waitForNotificationToGoAway(notificationMessage, durationInSeconds) {
    await findNotification(notificationMessage, false, durationInSeconds, true);
}
async function notificationIsPresent(notificationMessage) {
    const notification = await findNotification(notificationMessage, true, miscellaneous_1.Duration.milliseconds(500));
    return notification ? true : false;
}
async function notificationIsPresentWithTimeout(notificationMessage, durationInSeconds) {
    const notification = await findNotification(notificationMessage, true, durationInSeconds);
    return notification ? true : false;
}
async function notificationIsAbsent(notificationMessage) {
    const notification = await findNotification(notificationMessage, false, miscellaneous_1.Duration.milliseconds(500));
    return notification ? false : true;
}
async function notificationIsAbsentWithTimeout(notificationMessage, durationInSeconds) {
    const notification = await findNotification(notificationMessage, false, durationInSeconds);
    return notification ? false : true;
}
async function dismissNotification(notificationMessage, timeout = miscellaneous_1.Duration.seconds(1)) {
    const notification = await findNotification(notificationMessage, true, timeout, true);
    notification?.close();
}
async function acceptNotification(notificationMessage, actionName, timeout) {
    console.log(`${notificationMessage}, ${actionName}, ${timeout}`);
    await (0, commandPrompt_1.executeQuickPick)('Notifications: Show Notifications', miscellaneous_1.Duration.seconds(1));
    const actionButtons = await (0, workbench_1.getBrowser)().findElements(vscode_extension_tester_1.By.css(`div.notification-list-item-buttons-container > a.monaco-button.monaco-text-button`));
    for (const button of actionButtons) {
        if ((await button.getText()).includes(actionName)) {
            (0, miscellaneous_1.log)(`button ${actionName} found`);
            await button.click();
            return true;
        }
    }
    return false;
}
async function dismissAllNotifications() {
    (0, miscellaneous_1.log)(`calling dismissAllNotifications()`);
    await (0, commandPrompt_1.executeQuickPick)('Notifications: Clear All Notifications');
}
async function findNotification(message, shouldBePresent, timeout = miscellaneous_1.Duration.milliseconds(500), throwOnTimeout = false // New parameter to control throwing on timeout
) {
    const workbench = (0, workbench_1.getWorkbench)();
    const timeoutMessage = `Notification with message "${message}" ${shouldBePresent ? 'not found' : 'still present'} within the specified timeout of ${timeout.seconds} seconds.`;
    const getMatchingNotification = async () => {
        await workbench.openNotificationsCenter();
        const notifications = await workbench.getNotifications();
        for (const notification of notifications) {
            const notificationMessage = await notification.getMessage();
            if (notificationMessage === message || notificationMessage.includes(message)) {
                return notification;
            }
        }
        return null;
    };
    try {
        const endTime = Date.now() + timeout.milliseconds;
        let foundNotification = null;
        // Retry until timeout is reached or the notification status matches `shouldBePresent`
        do {
            foundNotification = await getMatchingNotification();
            if (foundNotification) {
                return foundNotification;
            }
            await new Promise(res => setTimeout(res, 100)); // Short delay before retrying
        } while (Date.now() < endTime);
        // Throw or return based on `throwOnTimeout`
        if (throwOnTimeout) {
            throw new Error(timeoutMessage);
        }
        return null;
    }
    catch (error) {
        if (throwOnTimeout) {
            throw error;
        }
        return null;
    }
}
//# sourceMappingURL=notifications.js.map