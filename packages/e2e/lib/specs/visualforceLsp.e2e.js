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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const chai_1 = require("chai");
const mocha_steps_1 = require("mocha-steps");
const path_1 = __importDefault(require("path"));
const vscode_extension_tester_1 = require("vscode-extension-tester");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
describe('Visualforce LSP', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: false,
        testSuiteSuffixName: 'VisualforceLsp'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        utilities.log('VisualforceLsp - Set up the testing environment');
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
        // Create Apex controller for the Visualforce Page
        await utilities.createApexController();
        // Clear output before running the command
        await utilities.clearOutputView();
        utilities.log(`${testSetup.testSuiteSuffixName} - calling createVisualforcePage()`);
        await utilities.createVisualforcePage();
        const pathToPagesFolder = path_1.default.join(testSetup.projectFolderPath, 'force-app', 'main', 'default', 'pages');
        const pathToPage = path_1.default.join('force-app', 'main', 'default', 'pages', 'FooPage.page');
        // Create an array of strings for the expected output text
        const expectedTexts = [
            `target dir = ${pathToPagesFolder}`,
            `create ${pathToPage}`,
            `create ${pathToPage}-meta.xml`,
            'Finished SFDX: Create Visualforce Page'
        ];
        // Check output panel to validate file was created...
        const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Create Visualforce Page', 10);
        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(outputPanelText, expectedTexts);
        // Get open text editor and verify file content
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'FooPage.page');
        const fileContent = await textEditor.getText();
        (0, chai_1.expect)(fileContent).to.contain('<apex:page controller="myController" tabStyle="Account">');
        (0, chai_1.expect)(fileContent).to.contain('</apex:page>');
    });
    (0, mocha_steps_1.xstep)('Go to Definition', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Go to Definition`);
        // Get open text editor
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'FooPage.page');
        await textEditor.moveCursor(1, 25);
        // Go to definition through F12
        await utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2));
        await utilities.pause(utilities.Duration.seconds(1));
        // TODO: go to definition is actually not working
        // // Verify 'Go to definition' took us to the definition file
        // const activeTab = await editorView.getActiveTab();
        // const title = await activeTab?.getTitle();
        // expect(title).toBe('MyController.cls');
    });
    (0, mocha_steps_1.step)('Autocompletion', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Autocompletion`);
        // Get open text editor
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'FooPage.page');
        await textEditor.typeTextAt(3, 1, '\t\t<apex:pageM');
        await utilities.pause(utilities.Duration.seconds(1));
        // Verify autocompletion options are present
        const autocompletionOptions = await workbench.findElements(vscode_extension_tester_1.By.css('div.monaco-list-row.show-file-icons'));
        const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
        (0, chai_1.expect)(ariaLabel).to.contain('apex:pageMessage');
        // Verify autocompletion options can be selected and therefore automatically inserted into the file
        await autocompletionOptions[0].click();
        await textEditor.typeText('/>');
        await textEditor.save();
        await utilities.pause(utilities.Duration.seconds(1));
        const line3Text = await textEditor.getTextAtLine(3);
        (0, chai_1.expect)(line3Text).to.contain('apex:pageMessage');
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=visualforceLsp.e2e.js.map