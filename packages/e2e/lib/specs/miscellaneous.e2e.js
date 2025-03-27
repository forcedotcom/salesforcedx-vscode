"use strict";
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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const chai_1 = require("chai");
const mocha_steps_1 = require("mocha-steps");
const vscode_extension_tester_1 = require("vscode-extension-tester");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
describe('Miscellaneous', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: false,
        testSuiteSuffixName: 'Miscellaneous'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
    });
    (0, mocha_steps_1.xstep)('Use out-of-the-box Apex Snippets', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Use Apex Snippets`);
        const workbench = await utilities.getWorkbench();
        const apexSnippet = 'String.isBlank(inputString)';
        // Create anonymous apex file
        await utilities.createAnonymousApexFile();
        // Type snippet "isb" in a new line and check it inserted the expected string
        const textEditor = await utilities.getTextEditor(workbench, 'Anonymous.apex');
        const inputBox = await utilities.executeQuickPick('Snippets: Insert Snippet', utilities.Duration.seconds(1));
        await inputBox.setText('isb');
        await utilities.pause(utilities.Duration.seconds(1));
        await inputBox.confirm();
        await textEditor.save();
        const fileContent = await textEditor.getText();
        await (0, chai_1.expect)(fileContent).to.contain(apexSnippet);
    });
    (0, mocha_steps_1.step)('Use Custom Apex Snippets', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Use Apex Snippets`);
        // Using the Command palette, run Snippets: Configure Snippets
        const workbench = await utilities.getWorkbench();
        await utilities.createGlobalSnippetsFile(testSetup);
        // Create anonymous apex file
        await utilities.createAnonymousApexFile();
        // Type snippet "soql" and check it inserted the expected query
        const textEditor = await utilities.getTextEditor(workbench, 'Anonymous.apex');
        await textEditor.typeText('soql');
        await utilities.pause(utilities.Duration.seconds(1));
        const autocompletionOptions = await workbench.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row.show-file-icons'));
        const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
        (0, chai_1.expect)(ariaLabel).to.contain('soql');
        // Verify autocompletion options can be selected and therefore automatically inserted into the file
        await autocompletionOptions[0].click();
        await textEditor.save();
        const fileContent = await textEditor.getText();
        (0, chai_1.expect)(fileContent).to.contain('[SELECT field1, field2 FROM SobjectName WHERE clause];');
    });
    (0, mocha_steps_1.step)('Use out-of-the-box LWC Snippets - HTML', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Use out-of-the-box LWC Snippets - HTML`);
        const workbench = await utilities.getWorkbench();
        const lwcSnippet = [
            '<lightning-button',
            '  variant="base"',
            '  label="Button Label"',
            '  onclick={handleClick}',
            '></lightning-button>'
        ].join('\n');
        // Create simple lwc.html file
        let inputBox = await utilities.executeQuickPick('Create: New File...', utilities.Duration.seconds(1));
        await inputBox.setText('lwc.html');
        await inputBox.confirm();
        await inputBox.confirm();
        // Type snippet "lwc-button" and check it inserted the right lwc
        const textEditor = await utilities.getTextEditor(workbench, 'lwc.html');
        inputBox = await utilities.executeQuickPick('Snippets: Insert Snippet', utilities.Duration.seconds(1));
        await inputBox.setText('lwc-button');
        await utilities.pause(utilities.Duration.seconds(2));
        await inputBox.confirm();
        await textEditor.save();
        const fileContent = await textEditor.getText();
        const fileContentWithoutTrailingSpaces = fileContent
            .split('\n')
            .map(line => line.trimEnd())
            .join('\n');
        await (0, chai_1.expect)(fileContentWithoutTrailingSpaces).to.contain(lwcSnippet);
    });
    (0, mocha_steps_1.step)('Use out-of-the-box LWC Snippets - JS', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Use out-of-the-box LWC Snippets - JS`);
        const workbench = await utilities.getWorkbench();
        const lwcSnippet = 'this.dispatchEvent(new CustomEvent("event-name"));';
        // Create simple lwc.js file
        const inputBox = await utilities.executeQuickPick('Create: New File...', utilities.Duration.seconds(1));
        await inputBox.setText('lwc.js');
        await inputBox.confirm();
        await inputBox.confirm();
        // Type snippet "lwc", select "lwc-event" and check it inserted the right thing
        const textEditor = await utilities.getTextEditor(workbench, 'lwc.js');
        await textEditor.typeText('lwc');
        await utilities.pause(utilities.Duration.seconds(1));
        const autocompletionOptions = await workbench.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row.show-file-icons'));
        const ariaLabel = await autocompletionOptions[2].getAttribute('aria-label');
        (0, chai_1.expect)(ariaLabel).to.contain('lwc-event');
        // Verify autocompletion options can be selected and therefore automatically inserted into the file
        await autocompletionOptions[2].click();
        await textEditor.save();
        const fileContent = await textEditor.getText();
        await (0, chai_1.expect)(fileContent).to.contain(lwcSnippet);
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=miscellaneous.e2e.js.map