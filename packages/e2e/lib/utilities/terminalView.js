"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTerminalView = getTerminalView;
exports.getTerminalViewText = getTerminalViewText;
exports.executeCommand = executeCommand;
const miscellaneous_1 = require("./miscellaneous");
async function getTerminalView(workbench) {
    const bottomBar = await workbench.getBottomBar().wait();
    const terminalView = await (await bottomBar.openTerminalView()).wait();
    return terminalView;
}
async function getTerminalViewText(workbench, seconds) {
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(seconds));
    const terminalView = await getTerminalView(workbench);
    return await terminalView.getText();
}
async function executeCommand(workbench, command) {
    (0, miscellaneous_1.log)(`Executing the command, "${command}"`);
    const terminalView = await (await getTerminalView(workbench)).wait();
    if (!terminalView) {
        throw new Error('In executeCommand(), the terminal view returned from getTerminalView() was null (or undefined)');
    }
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(5));
    await terminalView.executeCommand(command);
    return terminalView;
}
//# sourceMappingURL=terminalView.js.map