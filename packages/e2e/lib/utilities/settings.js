"use strict";
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.inWorkspaceSettings = inWorkspaceSettings;
exports.inUserSettings = inUserSettings;
exports.enableBooleanSetting = enableBooleanSetting;
exports.disableBooleanSetting = disableBooleanSetting;
exports.isBooleanSettingEnabled = isBooleanSettingEnabled;
const vscode_extension_tester_1 = require("vscode-extension-tester");
const commandPrompt_1 = require("./commandPrompt");
const miscellaneous_1 = require("./miscellaneous");
const workbench_1 = require("./workbench");
async function findAndCheckSetting(id) {
    (0, miscellaneous_1.debug)(`enter findAndCheckSetting for id: ${id}`);
    await (0, commandPrompt_1.executeQuickPick)('Preferences: Clear Settings Search Results', miscellaneous_1.Duration.seconds(2));
    const input = await (0, workbench_1.getBrowser)().findElement(vscode_extension_tester_1.By.css('div.suggest-input-container'));
    await input.click();
    const textArea = await (0, workbench_1.getBrowser)().findElement(vscode_extension_tester_1.By.css('textarea.inputarea.monaco-mouse-cursor-text'));
    await textArea.sendKeys(id);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(2));
    let checkButton = null;
    let checkButtonValue = null;
    await (0, workbench_1.getBrowser)().wait(async () => {
        checkButton = (await (0, miscellaneous_1.findElementByText)('div', 'aria-label', id));
        if (checkButton) {
            checkButtonValue = await checkButton.getAttribute('aria-checked');
            (0, miscellaneous_1.debug)(`found setting checkbox with value "${checkButtonValue}"`);
            return true;
        }
        return false;
    }, 5000, `Could not find setting with name: ${id}`);
    if (!checkButton) {
        throw new Error(`Could not find setting with name: ${id}`);
    }
    (0, miscellaneous_1.debug)(`findAndCheckSetting result for ${id} found ${!!checkButton} value: ${checkButtonValue}`);
    return { checkButton, checkButtonValue };
}
async function inWorkspaceSettings() {
    await (0, commandPrompt_1.executeQuickPick)('Preferences: Open Workspace Settings', miscellaneous_1.Duration.seconds(5));
}
async function inUserSettings() {
    await (0, commandPrompt_1.executeQuickPick)('Preferences: Open User Settings', miscellaneous_1.Duration.seconds(5));
}
async function toggleBooleanSetting(id, finalState, settingsType) {
    const settingsFunction = settingsType === 'workspace' ? inWorkspaceSettings : inUserSettings;
    await settingsFunction();
    let result = await findAndCheckSetting(id);
    if (finalState !== undefined) {
        if ((finalState && result.checkButtonValue === 'true') || (!finalState && result.checkButtonValue === 'false')) {
            return true;
        }
    }
    await result.checkButton.click();
    result = await findAndCheckSetting(id);
    return result.checkButtonValue === 'true';
}
async function enableBooleanSetting(id, settingsType = 'workspace') {
    (0, miscellaneous_1.debug)(`enableBooleanSetting ${id}`);
    return toggleBooleanSetting(id, true, settingsType);
}
async function disableBooleanSetting(id, settingsType = 'workspace') {
    (0, miscellaneous_1.debug)(`disableBooleanSetting ${id}`);
    return toggleBooleanSetting(id, false, settingsType);
}
async function isBooleanSettingEnabled(id, settingsType = 'workspace') {
    const settingsFunction = settingsType === 'workspace' ? inWorkspaceSettings : inUserSettings;
    await settingsFunction();
    const { checkButtonValue } = await findAndCheckSetting(id);
    return checkButtonValue === 'true';
}
//# sourceMappingURL=settings.js.map