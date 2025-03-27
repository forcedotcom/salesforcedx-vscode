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
const chai_1 = require("chai");
const vscode_extension_tester_1 = require("vscode-extension-tester");
describe('Org Browser', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: true,
        testSuiteSuffixName: 'OrgBrowser'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
    });
    (0, mocha_steps_1.step)('Check Org Browser is connected to target org', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Check Org Browser is connected to target org`);
        await utilities.openOrgBrowser(utilities.Duration.seconds(10));
        await utilities.verifyOrgBrowserIsOpen();
        utilities.log(`${testSetup.testSuiteSuffixName} - Org Browser is connected to target org`);
    });
    (0, mocha_steps_1.step)('Check some metadata types are available', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Check some metadata types are available`);
        const metadataTypes = [
            'AI Applications',
            'Apex Classes',
            'Apex Test Suites',
            'Apex Triggers',
            'App Menus',
            'Assignment Rules',
            'Aura Components',
            'Auth Providers',
            'Branding Sets',
            'Certificates',
            'Communities'
        ];
        for (const type of metadataTypes) {
            const element = await utilities.findTypeInOrgBrowser(type);
            (0, chai_1.expect)(element).to.not.be.undefined;
        }
    });
    (0, mocha_steps_1.step)('Verify there are no Apex Classes available', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify there are no Apex Classes available`);
        // Check there are no classes displayed
        const apexClassesLabelEl = await utilities.findTypeInOrgBrowser('Apex Classes');
        (0, chai_1.expect)(apexClassesLabelEl).to.not.be.undefined;
        await apexClassesLabelEl?.click();
        await utilities.pause(utilities.Duration.seconds(10));
        const noCompsAvailableLabelEl = await utilities.findElementByText('div', 'aria-label', 'No components available');
        (0, chai_1.expect)(noCompsAvailableLabelEl).to.not.be.undefined;
    });
    (0, mocha_steps_1.step)('Create Apex Class and deploy to org', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create Apex Class and deploy to org`);
        // Create Apex Class
        const classText = [
            `public with sharing class MyClass {`,
            ``,
            `\tpublic static void SayHello(string name){`,
            `\t\tSystem.debug('Hello, ' + name + '!');`,
            `\t}`,
            `}`
        ].join('\n');
        await utilities.createApexClass('MyClass', classText);
        await utilities.executeQuickPick('SFDX: Deploy This Source to Org', utilities.Duration.seconds(5));
        // Verify the deploy was successful
        const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Deploy This Source to Org successfully ran', utilities.Duration.FIVE_MINUTES);
        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        await utilities.closeCurrentEditor();
    });
    (0, mocha_steps_1.step)('Refresh Org Browser and check MyClass is there', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Refresh Apex Classes`);
        // Check MyClass is present under Apex Classes section
        const apexClassesItem = await utilities.findTypeInOrgBrowser('Apex Classes');
        (0, chai_1.expect)(apexClassesItem).to.not.be.undefined;
        const refreshComponentsButton = (await apexClassesItem?.findElements(vscode_extension_tester_1.By.css('a.action-label')))[1];
        (0, chai_1.expect)(refreshComponentsButton).to.not.be.undefined;
        await refreshComponentsButton?.click();
        await utilities.pause(utilities.Duration.seconds(10));
        const myClassLabelEl = await utilities.findTypeInOrgBrowser('MyClass');
        (0, chai_1.expect)(myClassLabelEl).to.not.be.undefined;
    });
    (0, mocha_steps_1.step)('Retrieve This Source from Org', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Retrieve This Source from Org`);
        const myClassLabelEl = await utilities.findTypeInOrgBrowser('MyClass');
        (0, chai_1.expect)(myClassLabelEl).to.not.be.undefined;
        await myClassLabelEl?.click();
        await utilities.pause(utilities.Duration.seconds(1));
        const retrieveSourceButton = (await myClassLabelEl?.findElements(vscode_extension_tester_1.By.css('a.action-label')))[1];
        (0, chai_1.expect)(retrieveSourceButton).to.not.be.undefined;
        await retrieveSourceButton.click();
        await utilities.pause(utilities.Duration.seconds(2));
        // Confirm Overwrite
        const modalDialog = new vscode_extension_tester_1.ModalDialog();
        (0, chai_1.expect)(modalDialog).to.not.be.undefined;
        await modalDialog.pushButton('Overwrite');
        const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Retrieve This Source from Org successfully ran', utilities.Duration.FIVE_MINUTES);
        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
    });
    (0, mocha_steps_1.step)('Retrieve and Open Source', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Retrieve and Open Source`);
        // Close all notifications
        await utilities.dismissAllNotifications();
        const myClassLabelEl = await utilities.findTypeInOrgBrowser('MyClass');
        (0, chai_1.expect)(myClassLabelEl).to.not.be.undefined;
        await myClassLabelEl?.click();
        await utilities.pause(utilities.Duration.seconds(1));
        const retrieveAndOpenSourceButton = (await myClassLabelEl?.findElements(vscode_extension_tester_1.By.css('a.action-label')))[0];
        (0, chai_1.expect)(retrieveAndOpenSourceButton).to.not.be.undefined;
        await retrieveAndOpenSourceButton.click();
        await utilities.pause(utilities.Duration.seconds(2));
        // Confirm Overwrite
        const modalDialog = new vscode_extension_tester_1.ModalDialog();
        (0, chai_1.expect)(modalDialog).to.not.be.undefined;
        await modalDialog.pushButton('Overwrite');
        const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Retrieve This Source from Org successfully ran', utilities.Duration.FIVE_MINUTES);
        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        // Verify 'Retrieve and Open Source' took us to MyClass.cls
        const workbench = utilities.getWorkbench();
        const editorView = workbench.getEditorView();
        const activeTab = await editorView.getActiveTab();
        const title = await activeTab?.getTitle();
        (0, chai_1.expect)(title).to.equal('MyClass.cls');
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=orgBrowser.e2e.js.map