"use strict";
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVisualforcePage = createVisualforcePage;
const commandPrompt_1 = require("./commandPrompt");
const miscellaneous_1 = require("./miscellaneous");
const textEditorView_1 = require("./textEditorView");
const workbench_1 = require("./workbench");
async function createVisualforcePage() {
    (0, miscellaneous_1.log)(`calling createVisualforcePage()`);
    // Using the Command palette, run SFDX: Create Visualforce Page
    const inputBox = await (0, commandPrompt_1.executeQuickPick)('SFDX: Create Visualforce Page');
    // Set the name of the new Visualforce Page
    await inputBox.setText('FooPage');
    await inputBox.confirm();
    await inputBox.confirm();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
    // Modify page content
    const workbench = (0, workbench_1.getWorkbench)();
    const textEditor = await (0, textEditorView_1.getTextEditor)(workbench, 'FooPage.page');
    const pageText = [
        `<apex:page controller="myController" tabStyle="Account">`,
        `\t<apex:form>`,
        `\t`,
        `\t\t<apex:pageBlock title="Congratulations {!$User.FirstName}">`,
        `\t\t\tYou belong to Account Name: <apex:inputField value="{!account.name}"/>`,
        `\t\t\t<apex:commandButton action="{!save}" value="save"/>`,
        `\t\t</apex:pageBlock>`,
        `\t</apex:form>`,
        `</apex:page>`
    ].join('\n');
    await textEditor.setText(pageText);
    await textEditor.save();
    await (0, miscellaneous_1.pause)(miscellaneous_1.Duration.seconds(1));
}
//# sourceMappingURL=visualforceUtils.js.map