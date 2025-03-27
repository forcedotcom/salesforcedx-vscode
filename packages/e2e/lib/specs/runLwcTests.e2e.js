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
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const assert_1 = require("assert");
const chai_1 = require("chai");
const mocha_steps_1 = require("mocha-steps");
const path_1 = __importDefault(require("path"));
const vscode_extension_tester_1 = require("vscode-extension-tester");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
describe('Run LWC Tests', async () => {
    let projectFolderPath;
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: false,
        testSuiteSuffixName: 'RunLWCTests'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
        projectFolderPath = testSetup.projectFolderPath;
        // Close both Welcome and Running Extensions tabs
        await utilities.closeAllEditors();
        // Create LWC1 and test
        await utilities.createLwc('lwc1');
        // Create LWC2 and test
        await utilities.createLwc('lwc2');
        // Install Jest unit testing tools for LWC
        await utilities.installJestUTToolsForLwc(testSetup.projectFolderPath);
    });
    (0, mocha_steps_1.step)('SFDX: Run All Lightning Web Component Tests from Command Palette', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - SFDX: Run All Lightning Web Component Tests from Command Palette`);
        // Run SFDX: Run All Lightning Web Component Tests.
        await utilities.executeQuickPick('SFDX: Run All Lightning Web Component Tests', utilities.Duration.seconds(1));
        // Verify test results are listed on the terminal
        // Also verify that all tests pass
        const workbench = utilities.getWorkbench();
        const terminalText = await utilities.getTerminalViewText(workbench, 10);
        const expectedTexts = [
            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
            'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
            'Test Suites: 2 passed, 2 total',
            'Tests:       4 passed, 4 total',
            'Snapshots:   0 total',
            'Ran all test suites.'
        ];
        (0, chai_1.expect)(terminalText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(terminalText, expectedTexts);
    });
    (0, mocha_steps_1.step)('SFDX: Refresh Lightning Web Component Test Explorer', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - SFDX: Refresh Lightning Web Component Test Explorer`);
        await utilities.executeQuickPick('Testing: Focus on LWC Tests View', utilities.Duration.seconds(1));
        // Run command SFDX: Refresh Lightning Web Component Test Explorer
        await utilities.executeQuickPick('SFDX: Refresh Lightning Web Component Test Explorer', utilities.Duration.seconds(2));
        // Open the Tests Sidebar
        const workbench = utilities.getWorkbench();
        const lwcTestsSection = await utilities.getTestsSection(workbench, 'LWC Tests');
        let lwcTestsItems = (await lwcTestsSection.getVisibleItems());
        // Run command SFDX: Run All Lightning Web Component Tests
        await utilities.executeQuickPick('SFDX: Run All Lightning Web Component Tests', utilities.Duration.seconds(2));
        // Get tree items again
        lwcTestsItems = (await lwcTestsSection.getVisibleItems());
        // Verify the tests that ran are labeled with a green dot on the Test sidebar
        for (const item of lwcTestsItems) {
            await utilities.verifyTestIconColor(item, 'testPass');
        }
        // Run command SFDX: Refresh Lightning Web Component Test Explorer again to reset status
        await utilities.executeQuickPick('SFDX: Refresh Lightning Web Component Test Explorer', utilities.Duration.seconds(2));
        // Get tree items again
        lwcTestsItems = (await lwcTestsSection.getVisibleItems());
        // Verify the tests are now labeled with a blue dot on the Test sidebar
        for (const item of lwcTestsItems) {
            await utilities.verifyTestIconColor(item, 'testNotRun');
        }
    });
    (0, mocha_steps_1.step)('Run All tests via Test Sidebar', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Run All tests via Test Sidebar`);
        const workbench = utilities.getWorkbench();
        const lwcTestsSection = await utilities.getTestsSection(workbench, 'LWC Tests');
        const expectedItems = ['lwc1', 'lwc2', 'displays greeting', 'is defined'];
        const lwcTestsItems = await utilities.verifyTestItemsInSideBar(lwcTestsSection, 'SFDX: Refresh Lightning Web Component Test Explorer', expectedItems, 6, 2);
        // Click the run tests button on the top right corner of the Test sidebar
        await lwcTestsSection.click();
        const runTestsAction = await lwcTestsSection.getAction('SFDX: Run All Lightning Web Component Tests');
        (0, chai_1.expect)(runTestsAction).to.not.be.undefined;
        await runTestsAction.click();
        // Verify test results are listed on the terminal
        // Also verify that all tests pass
        const terminalText = await utilities.getTerminalViewText(workbench, 10);
        const expectedTexts = [
            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
            'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
            'Test Suites: 2 passed, 2 total',
            'Tests:       4 passed, 4 total',
            'Snapshots:   0 total',
            'Ran all test suites.'
        ];
        (0, chai_1.expect)(terminalText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(terminalText, expectedTexts);
        // Verify the tests that are passing are labeled with a green dot on the Test sidebar
        for (const item of lwcTestsItems) {
            await utilities.verifyTestIconColor(item, 'testPass');
        }
    });
    (0, mocha_steps_1.step)('Run All Tests on a LWC via the Test Sidebar', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Run All Tests on a LWC via the Test Sidebar`);
        const workbench = utilities.getWorkbench();
        // Click the run test button that is shown to the right when you hover a test class name on the Test sidebar
        const terminalText = await utilities.runTestCaseFromSideBar(workbench, 'LWC Tests', 'lwc1', 'SFDX: Run Lightning Web Component Test File');
        const expectedTexts = [
            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
            'Test Suites: 1 passed, 1 total',
            'Tests:       2 passed, 2 total',
            'Snapshots:   0 total',
            'Ran all test suites within paths',
            `${path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js')}`
        ];
        (0, chai_1.expect)(terminalText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(terminalText, expectedTexts);
        await utilities.closeAllEditors();
    });
    (0, mocha_steps_1.step)('Run Single Test via the Test Sidebar', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Run Single Test via the Test Sidebar`);
        const workbench = utilities.getWorkbench();
        // Hover a test name under one of the test lwc sections and click the run button that is shown to the right of the test name on the Test sidebar
        const terminalText = await utilities.runTestCaseFromSideBar(workbench, 'LWC Tests', 'displays greeting', 'SFDX: Run Lightning Web Component Test Case');
        const expectedTexts = [
            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
            'Test Suites: 1 passed, 1 total',
            'Tests:       1 skipped, 1 passed, 2 total',
            'Snapshots:   0 total',
            'Ran all test suites within paths',
            `${path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js')}`
        ];
        (0, chai_1.expect)(terminalText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(terminalText, expectedTexts);
    });
    (0, mocha_steps_1.step)('SFDX: Navigate to Lightning Web Component Test', async () => {
        // Verify that having clicked the test case took us to the test file.
        await utilities.reloadWindow();
        await utilities.pause(utilities.Duration.seconds(10));
        const workbench = utilities.getWorkbench();
        const editorView = workbench.getEditorView();
        const activeTab = await editorView.getActiveTab();
        const title = await activeTab?.getTitle();
        (0, chai_1.expect)(title).to.equal('lwc1.test.js');
    });
    (0, mocha_steps_1.step)('SFDX: Run Current Lightning Web Component Test File from Command Palette', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - SFDX: Run Current Lightning Web Component Test File`);
        // Run SFDX: Run Current Lightning Web Component Test File
        await utilities.executeQuickPick('SFDX: Run Current Lightning Web Component Test File', utilities.Duration.seconds(1));
        // Verify test results are listed on vscode's Output section
        // Also verify that all tests pass
        const workbench = utilities.getWorkbench();
        const terminalText = await utilities.getTerminalViewText(workbench, 10);
        const expectedTexts = [
            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
            'Test Suites: 1 passed, 1 total',
            'Tests:       2 passed, 2 total',
            'Snapshots:   0 total',
            'Ran all test suites within paths',
            `${path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js')}`
        ];
        (0, chai_1.expect)(terminalText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(terminalText, expectedTexts);
    });
    (0, mocha_steps_1.xstep)('Run All Tests via Code Lens action', async () => {
        // Skipping as this feature is currently not working
        utilities.log(`${testSetup.testSuiteSuffixName} - Run All Tests via Code Lens action`);
        const workbench = utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'lwc1.test.js');
        // Click the "Run" code lens at the top of the class
        const runAllTestsOption = await textEditor.getCodeLens('Run');
        if (!runAllTestsOption) {
            (0, assert_1.fail)('Could not find run all tests action button');
        }
        await runAllTestsOption.click();
        // Verify test results are listed on the terminal
        // Also verify that all tests pass
        const terminalText = await utilities.getTerminalViewText(workbench, 10);
        const expectedTexts = [
            'PASS  force-app/main/default/lwc/lwc1/__tests__/lwc1.test.js',
            'Test Suites: 1 passed, 1 total',
            'Tests:       2 passed, 2 total',
            'Snapshots:   0 total',
            'Ran all test suites within paths',
            `${path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc1', '__tests__', 'lwc1.test.js')}`
        ];
        (0, chai_1.expect)(terminalText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(terminalText, expectedTexts);
    });
    (0, mocha_steps_1.step)('Run Single Test via Code Lens action', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Run Single Test via Code Lens action`);
        // Click the "Run Test" code lens at the top of one of the test methods
        const workbench = utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'lwc2.test.js');
        const runTestOption = await textEditor.getCodeLens('Run Test');
        if (!runTestOption) {
            (0, assert_1.fail)('Could not find run test action button');
        }
        await runTestOption.click();
        // Verify test results are listed on the terminal
        // Also verify that all tests pass
        const terminalText = await utilities.getTerminalViewText(workbench, 10);
        const expectedTexts = [
            'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
            'Test Suites: 1 passed, 1 total',
            'Tests:       1 skipped, 1 passed, 2 total',
            'Snapshots:   0 total',
            'Ran all test suites within paths',
            `${path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc2', '__tests__', 'lwc2.test.js')}`
        ];
        (0, chai_1.expect)(terminalText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(terminalText, expectedTexts);
    });
    (0, mocha_steps_1.step)('SFDX: Run Current Lightning Web Component Test File from main toolbar', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - SFDX: Run Current Lightning Web Component Test File from main toolbar`);
        // Run SFDX: Run Current Lightning Web Component Test File
        const workbench = utilities.getWorkbench();
        const editorView = workbench.getEditorView();
        const runTestButtonToolbar = await editorView.getAction('SFDX: Run Current Lightning Web Component Test File');
        (0, chai_1.expect)(runTestButtonToolbar).to.not.be.undefined;
        await runTestButtonToolbar?.click();
        // Verify test results are listed on vscode's Output section
        // Also verify that all tests pass
        const terminalText = await utilities.getTerminalViewText(workbench, 10);
        const expectedTexts = [
            'PASS  force-app/main/default/lwc/lwc2/__tests__/lwc2.test.js',
            'Test Suites: 1 passed, 1 total',
            'Tests:       2 passed, 2 total',
            'Snapshots:   0 total',
            'Ran all test suites within paths',
            `${path_1.default.join('force-app', 'main', 'default', 'lwc', 'lwc2', '__tests__', 'lwc2.test.js')}`
        ];
        (0, chai_1.expect)(terminalText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(terminalText, expectedTexts);
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=runLwcTests.e2e.js.map