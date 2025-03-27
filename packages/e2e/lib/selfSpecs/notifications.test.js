"use strict";
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const utilities = __importStar(require("../utilities/index")); // Assuming utilities is a module in your project
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function showNotification(message) {
    // await utilities.getBrowser().executeWorkbench(async (vscode, message) => {
    //   vscode.window.showInformationMessage(`${message}`);
    // }, message);
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function showNotificationWithActions(message, ...actions) {
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
        const isPresent = await utilities.notificationIsPresentWithTimeout('Modify the file and retrieve again', utilities.Duration.seconds(2));
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (0, chai_1.expect)(isPresent).to.equal(true);
        await utilities.dismissNotification('Modify the file and retrieve again');
        await utilities.pause(utilities.Duration.seconds(1));
        const isNotPresent = await utilities.notificationIsAbsentWithTimeout('Modify the file and retrieve again', utilities.Duration.seconds(1));
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (0, chai_1.expect)(isNotPresent).to.equal(true);
        await utilities.pause(utilities.Duration.seconds(2));
    });
    it('should show a notification with two actions', async () => {
        await showNotificationWithActions('Choose an action:', 'A', 'B');
        const isPresent = await utilities.notificationIsPresentWithTimeout('Choose an action:', utilities.Duration.seconds(1));
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (0, chai_1.expect)(isPresent).to.equal(true);
        await utilities.pause(utilities.Duration.seconds(1));
        await utilities.acceptNotification('Choose an action:', 'A', utilities.Duration.seconds(1));
        const isNotPresent = await utilities.notificationIsAbsentWithTimeout('Choose an action:', utilities.Duration.seconds(5));
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (0, chai_1.expect)(isNotPresent).to.equal(true);
    });
});
//# sourceMappingURL=notifications.test.js.map