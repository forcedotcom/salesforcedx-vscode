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
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const mocha_steps_1 = require("mocha-steps");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
describe('Debug Apex Tests', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: true,
        testSuiteSuffixName: 'DebugApexTests'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        utilities.log(`DebugApexTests - Set up the testing environment`);
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
        // Create Apex class 1 and test
        try {
            await utilities.createApexClassWithTest('ExampleApexClass1');
        }
        catch (error) {
            await utilities.createApexClassWithTest('ExampleApexClass1');
        }
        // Create Apex class 2 and test
        try {
            await utilities.createApexClassWithTest('ExampleApexClass2');
        }
        catch (error) {
            await utilities.createApexClassWithTest('ExampleApexClass2');
        }
        // Push source to org
        await utilities.executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', utilities.Duration.seconds(1));
        // Look for the success notification that appears which says, "SFDX: Push Source to Default Org and Ignore Conflicts successfully ran".
        let successPushNotificationWasFound;
        try {
            successPushNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.TEN_MINUTES);
            (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
        }
        catch (error) {
            await utilities.getWorkbench().openNotificationsCenter();
            successPushNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org and Ignore Conflicts successfully ran', utilities.Duration.TEN_MINUTES);
            (0, chai_1.expect)(successPushNotificationWasFound).to.equal(true);
        }
    });
    (0, mocha_steps_1.step)('Verify LSP finished indexing', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify LSP finished indexing`);
        // Get Apex LSP Status Bar
        const statusBar = await utilities.getStatusBarItemWhichIncludes('Editor Language Status');
        await statusBar.click();
        (0, chai_1.expect)(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
    });
    (0, mocha_steps_1.step)('Debug All Tests via Apex Class', async () => {
        utilities.log(`DebugApexTests - Debug All Tests via Apex Class`);
        const workbench = utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'ExampleApexClass1Test.cls');
        // Clear the Output view.
        await utilities.dismissAllNotifications();
        // Click the "Debug All Tests" code lens at the top of the class
        const debugAllTestsOption = await textEditor.getCodeLens('Debug All Tests');
        await debugAllTestsOption.click();
        await utilities.pause(utilities.Duration.seconds(20));
        // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
        let successNotificationWasFound;
        try {
            successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.TEN_MINUTES);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        }
        catch (error) {
            await workbench.openNotificationsCenter();
            successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.ONE_MINUTE);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        }
        // Continue with the debug session
        await utilities.continueDebugging(2, 30);
    });
    (0, mocha_steps_1.step)('Debug Single Test via Apex Class', async () => {
        utilities.log(`DebugApexTests - Debug Single Test via Apex Class`);
        const workbench = utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'ExampleApexClass2Test.cls');
        // Clear the Output view.
        await utilities.dismissAllNotifications();
        // Click the "Debug Test" code lens at the top of one of the test methods
        const debugTestOption = await textEditor.getCodeLens('Debug Test');
        await debugTestOption.click();
        await utilities.pause(utilities.Duration.seconds(20));
        // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
        let successNotificationWasFound;
        try {
            successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.TEN_MINUTES);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        }
        catch (error) {
            await workbench.openNotificationsCenter();
            successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.ONE_MINUTE);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        }
        // Continue with the debug session
        await utilities.continueDebugging(2, 30);
    });
    (0, mocha_steps_1.step)('Debug all Apex Methods on a Class via the Test Sidebar', async () => {
        utilities.log(`DebugApexTests - Debug All Apex Methods on a Class via the Test Sidebar`);
        const workbench = utilities.getWorkbench();
        await utilities.executeQuickPick('Testing: Focus on Apex Tests View', utilities.Duration.seconds(1));
        // Open the Test Sidebar
        const apexTestsSection = await utilities.getTestsSection(workbench, 'Apex Tests');
        const expectedItems = ['ExampleApexClass1Test', 'ExampleApexClass2Test'];
        await utilities.verifyTestItemsInSideBar(apexTestsSection, 'Refresh Tests', expectedItems, 4, 2);
        // Click the debug tests button that is shown to the right when you hover a test class name on the Test sidebar
        await apexTestsSection.click();
        const apexTestItem = (await apexTestsSection.findItem('ExampleApexClass1Test'));
        await apexTestItem.select();
        const debugTestsAction = await apexTestItem.getActionButton('Debug Tests');
        (0, chai_1.expect)(debugTestsAction).to.not.be.undefined;
        await debugTestsAction?.click();
        await utilities.pause(utilities.Duration.seconds(20));
        // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
        let successNotificationWasFound;
        try {
            successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.TEN_MINUTES);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        }
        catch (error) {
            await workbench.openNotificationsCenter();
            successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.ONE_MINUTE);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        }
        // Continue with the debug session
        await utilities.continueDebugging(2, 30);
    });
    (0, mocha_steps_1.step)('Debug a Single Apex Test Method via the Test Sidebar', async () => {
        utilities.log(`DebugApexTests - 'Debug Single Apex Test Method via the Test Sidebar`);
        const workbench = utilities.getWorkbench();
        await utilities.executeQuickPick('Testing: Focus on Apex Tests View', utilities.Duration.seconds(1));
        // Open the Test Sidebar
        const apexTestsSection = await utilities.getTestsSection(workbench, 'Apex Tests');
        // Hover a test name under one of the test class sections and click the debug button that is shown to the right of the test name on the Test sidebar
        await apexTestsSection.click();
        const apexTestItem = (await apexTestsSection.findItem('validateSayHello'));
        await apexTestItem.select();
        const debugTestAction = await apexTestItem.getActionButton('Debug Single Test');
        (0, chai_1.expect)(debugTestAction).to.not.be.undefined;
        await debugTestAction?.click();
        await utilities.pause(utilities.Duration.seconds(20));
        // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
        let successNotificationWasFound;
        try {
            successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.TEN_MINUTES);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        }
        catch (error) {
            await workbench.openNotificationsCenter();
            successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('Debug Test(s) successfully ran', utilities.Duration.ONE_MINUTE);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        }
        // Continue with the debug session
        await utilities.continueDebugging(2, 30);
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        utilities.log(`DebugApexTests - Tear down and clean up the testing environment`);
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=debugApexTests.e2e.js.map