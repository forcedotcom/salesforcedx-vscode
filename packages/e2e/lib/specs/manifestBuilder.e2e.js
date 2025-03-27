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
const mocha_steps_1 = require("mocha-steps");
const path_1 = __importDefault(require("path"));
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
describe('Manifest Builder', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: true,
        testSuiteSuffixName: 'ManifestBuilder'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
    });
    (0, mocha_steps_1.step)('Generate Manifest File', async () => {
        // Normally we would want to run the 'SFDX: Generate Manifest File' command here, but it is only
        // accessible via a context menu, and wdio-vscode-service isn't able to interact with
        // context menus, so instead the manifest file is manually created:
        utilities.log(`${testSetup.testSuiteSuffixName} - calling createCustomObjects()`);
        await utilities.createCustomObjects(testSetup);
        if (process.platform !== 'darwin') {
            utilities.log(`${testSetup.testSuiteSuffixName} - creating manifest file`);
            const workbench = utilities.getWorkbench();
            const sidebar = await workbench.getSideBar().wait();
            const content = await sidebar.getContent().wait();
            const treeViewSection = await content.getSection(testSetup.tempProjectName);
            if (!treeViewSection) {
                throw new Error('In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)');
            }
            const objectTreeItem = (await treeViewSection.findItem('objects'));
            if (!objectTreeItem) {
                throw new Error('In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)');
            }
            (0, chai_1.expect)(objectTreeItem).to.not.be.undefined;
            await (await objectTreeItem.wait()).expand();
            const contextMenu = await objectTreeItem.openContextMenu();
            await contextMenu.select('SFDX: Generate Manifest File');
            const inputBox = await vscode_extension_tester_1.InputBox.create();
            await inputBox.setText('manifest');
            await inputBox.confirm();
        }
        if (process.platform === 'darwin') {
            // Using the Command palette, run File: New File...
            const inputBox = await utilities.executeQuickPick('Create: New File...', utilities.Duration.seconds(1));
            // Set the name of the new manifest file
            const filePath = path_1.default.join('manifest', 'manifest.xml');
            await inputBox.setText(filePath);
            // The following 3 confirms are just confirming the file creation and the folder it will belong to
            await inputBox.confirm();
            await inputBox.confirm();
            await inputBox.confirm();
            const workbench = utilities.getWorkbench();
            const textEditor = await utilities.getTextEditor(workbench, 'manifest.xml');
            const content = [
                `<?xml version="1.0" encoding="UTF-8"?>`,
                `<Package xmlns="http://soap.sforce.com/2006/04/metadata">`,
                `\t<types>`,
                `\t\t<members>*</members>`,
                `\t\t<name>CustomObject</name>`,
                `\t</types>`,
                `\t<version>57.0</version>`,
                `</Package>`
            ].join('\n');
            await textEditor.setText(content);
            await textEditor.save();
            await utilities.pause(utilities.Duration.seconds(1));
        }
    });
    (0, mocha_steps_1.step)('SFDX: Deploy Source in Manifest to Org', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - SFDX: Deploy Source in Manifest to Org`);
        // Clear output before running the command
        await utilities.clearOutputView();
        if (process.platform === 'linux') {
            // Dismiss all notifications using the button in the status bar
            const workbench = utilities.getWorkbench();
            const statusBar = workbench.getStatusBar();
            const notificationsButton = await statusBar.getItem('Notifications');
            if (notificationsButton) {
                await notificationsButton.click();
                const notificationsCenter = await workbench.openNotificationsCenter();
                await notificationsCenter.clearAllNotifications();
            }
            // Using the Context menu, run SFDX: Deploy Source in Manifest to Org
            const sidebar = await workbench.getSideBar().wait();
            const content = await sidebar.getContent().wait();
            const treeViewSection = await content.getSection(testSetup.tempProjectName);
            if (!treeViewSection) {
                throw new Error('In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)');
            }
            const manifestTreeItem = (await treeViewSection.findItem('manifest'));
            if (!manifestTreeItem) {
                throw new Error('In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)');
            }
            (0, chai_1.expect)(manifestTreeItem).to.not.be.undefined;
            await (await manifestTreeItem.wait()).expand();
            // Locate the "manifest.xml" file within the expanded "manifest" folder
            const manifestXmlFile = (await treeViewSection.findItem('manifest.xml'));
            if (!manifestXmlFile) {
                throw new Error('No manifest.xml file found');
            }
            (0, chai_1.expect)(manifestXmlFile).to.not.be.undefined;
            const contextMenu = await manifestXmlFile.openContextMenu();
            await contextMenu.select('SFDX: Deploy Source in Manifest to Org');
        }
        else {
            // Using the Command palette, run SFDX: Deploy Source in Manifest to Org
            await utilities.executeQuickPick('SFDX: Deploy Source in Manifest to Org', utilities.Duration.seconds(10));
        }
        // Look for the success notification that appears which says, "SFDX: Deploy This Source to Org successfully ran".
        const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Deploy This Source to Org successfully ran', utilities.Duration.TEN_MINUTES);
        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        const expectedTexts = [
            'Deployed Source',
            `Customer__c  CustomObject  ${path_1.default.join('force-app', 'main', 'default', 'objects', 'Customer__c', 'Customer__c.object-meta.xml')}`,
            `Product__c   CustomObject  ${path_1.default.join('force-app', 'main', 'default', 'objects', 'Product__c', 'Product__c.object-meta.xml')}`,
            'ended SFDX: Deploy This Source to Org'
        ];
        // Verify Output tab
        const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Deploy This Source to Org', 10);
        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(outputPanelText, expectedTexts);
    });
    (0, mocha_steps_1.step)('SFDX: Retrieve Source in Manifest from Org', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - SFDX: Retrieve Source in Manifest from Org`);
        const workbench = utilities.getWorkbench();
        await utilities.getTextEditor(workbench, 'manifest.xml');
        // Clear output before running the command
        await utilities.clearOutputView();
        if (process.platform === 'linux') {
            // Dismiss all notifications using the button in the status bar
            const workbench = utilities.getWorkbench();
            const statusBar = workbench.getStatusBar();
            const notificationsButton = await statusBar.getItem('Notifications');
            if (notificationsButton) {
                await notificationsButton.click();
                const notificationsCenter = await workbench.openNotificationsCenter();
                await notificationsCenter.clearAllNotifications();
            }
            // Using the Context menu, run SFDX: Retrieve Source in Manifest from Org
            const sidebar = await workbench.getSideBar().wait();
            const content = await sidebar.getContent().wait();
            const treeViewSection = await content.getSection(testSetup.tempProjectName);
            if (!treeViewSection) {
                throw new Error('In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)');
            }
            const manifestTreeItem = (await treeViewSection.findItem('manifest'));
            if (!manifestTreeItem) {
                throw new Error('In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)');
            }
            (0, chai_1.expect)(manifestTreeItem).to.not.be.undefined;
            await (await manifestTreeItem.wait()).expand();
            // Locate the "manifest.xml" file within the expanded "manifest" folder
            const manifestXmlFile = (await treeViewSection.findItem('manifest.xml'));
            if (!manifestXmlFile) {
                throw new Error('No manifest.xml file found');
            }
            (0, chai_1.expect)(manifestXmlFile).to.not.be.undefined;
            const contextMenu = await manifestXmlFile.openContextMenu();
            await contextMenu.select('SFDX: Retrieve Source in Manifest from Org');
        }
        else {
            // Using the Command palette, run SFDX: Retrieve Source in Manifest from Org
            await utilities.executeQuickPick('SFDX: Retrieve Source in Manifest from Org', utilities.Duration.seconds(10));
        }
        // Look for the success notification that appears which says, "SFDX: Retrieve This Source from Org successfully ran".
        const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Retrieve This Source from Org successfully ran', utilities.Duration.TEN_MINUTES);
        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        const expectedTexts = [
            'Retrieved Source',
            `Customer__c  CustomObject  ${path_1.default.join('force-app', 'main', 'default', 'objects', 'Customer__c', 'Customer__c.object-meta.xml')}`,
            `Product__c   CustomObject  ${path_1.default.join('force-app', 'main', 'default', 'objects', 'Product__c', 'Product__c.object-meta.xml')}`,
            'ended SFDX: Retrieve This Source from Org'
        ];
        // Verify Output tab
        const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Retrieve This Source from Org', 10);
        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(outputPanelText, expectedTexts);
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=manifestBuilder.e2e.js.map