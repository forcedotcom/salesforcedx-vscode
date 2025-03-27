"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.openCommandPromptWithCommand = openCommandPromptWithCommand;
exports.runCommandFromCommandPrompt = runCommandFromCommandPrompt;
exports.selectQuickPickWithText = selectQuickPickWithText;
exports.selectQuickPickItem = selectQuickPickItem;
exports.findQuickPickItem = findQuickPickItem;
exports.waitForQuickPick = waitForQuickPick;
exports.executeQuickPick = executeQuickPick;
exports.clickFilePathOkButton = clickFilePathOkButton;
const miscellaneous_1 = require("./miscellaneous");
const workbench_1 = require("./workbench");
const vscode_extension_tester_1 = require("vscode-extension-tester");
async function openCommandPromptWithCommand(workbench, command) {
    const prompt = await (await workbench.openCommandPrompt()).wait();
    await (await prompt.wait()).setText(`>${command}`);
    return prompt;
}
async function runCommandFromCommandPrompt(workbench, command, durationInSeconds = miscellaneous_1.Duration.seconds(0)) {
    const prompt = await (await openCommandPromptWithCommand(workbench, command)).wait();
    await selectQuickPickItem(prompt, command);
    if (durationInSeconds.milliseconds > 0) {
        await (0, miscellaneous_1.pause)(durationInSeconds);
    }
    return prompt;
}
async function selectQuickPickWithText(prompt, text) {
    // Set the text in the command prompt.  Only selectQuickPick() needs to be called, but setting
    // the text in the command prompt is a nice visual feedback to anyone watching the tests run.
    await prompt.setText(text);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    await prompt.selectQuickPick(text);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    // After the text has been entered and selectQuickPick() is called, you might see the last few characters
    // in the input box be deleted.  This is b/c selectQuickPick() calls resetPosition(), which for some reason
    // deletes the last two characters.  This doesn't seem to affect the outcome though.
}
async function selectQuickPickItem(prompt, text) {
    if (!prompt) {
        throw new Error('Prompt cannot be undefined');
    }
    const quickPick = await prompt.findQuickPick(text);
    if (!quickPick || (await quickPick.getLabel()) !== text) {
        throw new Error(`Quick pick item ${text} was not found`);
    }
    await quickPick.select();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
}
async function findQuickPickItem(inputBox, quickPickItemTitle, useExactMatch, selectTheQuickPickItem) {
    if (!inputBox) {
        return false;
    }
    // Type the text into the filter.  Do this in case the pick list is long and
    // the target item is not visible (and one needs to scroll down to see it).
    await inputBox.setText(quickPickItemTitle);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    let itemWasFound = false;
    const quickPicks = await inputBox.getQuickPicks();
    for (const quickPick of quickPicks) {
        const label = await quickPick.getLabel();
        if (useExactMatch && label === quickPickItemTitle) {
            itemWasFound = true;
        }
        else if (!useExactMatch && label.includes(quickPickItemTitle)) {
            itemWasFound = true;
        }
        if (itemWasFound) {
            if (selectTheQuickPickItem) {
                await quickPick.select();
                await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
            }
            return true;
        }
    }
    return false;
}
async function waitForQuickPick(prompt, pickListItem, options = { timeout: miscellaneous_1.Duration.milliseconds(10_000) }) {
    await (0, workbench_1.getBrowser)().wait(async () => {
        try {
            await findQuickPickItem(prompt, pickListItem, false, true);
            return true;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        }
        catch (_) {
            return false;
        }
    }, options.timeout?.milliseconds, options.msg ?? `Expected to find option ${pickListItem} before ${options.timeout} milliseconds`, 500 // Check every 500 ms
    );
}
/**
 * Runs exact command from command palette
 * @param command
 * @param wait - default is  1 second
 * @returns
 */
async function executeQuickPick(command, wait = miscellaneous_1.Duration.seconds(1)) {
    (0, miscellaneous_1.debug)(`executeQuickPick command: ${command}`);
    try {
        console.log('A');
        const workbench = (0, workbench_1.getWorkbench)();
        console.log('B');
        const prompt = await workbench.openCommandPrompt();
        console.log('C');
        await prompt.setText(`>${command}`);
        console.log('D');
        await prompt.selectQuickPick(command);
        console.log('E');
        // await pause(wait);
        console.log('F');
        return prompt;
    }
    catch (error) {
        let errorMessage;
        console.log('madhur 1: ', error);
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        else if (typeof error === 'string') {
            errorMessage = error;
        }
        else {
            throw new Error(`Unknown error: ${error}`);
        }
        console.log('madhur 2: ', errorMessage);
        if (errorMessage.includes('Command not found')) {
            throw new Error(`Command not found: ${command}`);
        }
        else {
            throw error;
        }
    }
}
async function clickFilePathOkButton() {
    const browser = (0, workbench_1.getBrowser)();
    const okButton = await browser.findElement(vscode_extension_tester_1.By.css('*:not([style*="display: none"]).quick-input-action .monaco-button'));
    if (!okButton) {
        throw new Error('Ok button not found');
    }
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.milliseconds(500));
    await okButton.sendKeys(vscode_extension_tester_1.Key.ENTER);
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    const buttons = await browser.findElements(vscode_extension_tester_1.By.css('a.monaco-button.monaco-text-button'));
    for (const item of buttons) {
        const text = await item.getText();
        if (text.includes('Overwrite')) {
            (0, miscellaneous_1.log)('clickFilePathOkButton() - folder already exists');
            await browser.wait(async () => (await item.isDisplayed()) && (await item.isEnabled()), miscellaneous_1.Duration.seconds(5).milliseconds, `Overwrite button not clickable within 5 seconds`);
            await item.click();
            break;
        }
    }
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(2));
}
//# sourceMappingURL=commandPrompt.js.map