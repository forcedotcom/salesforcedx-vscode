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
const index_1 = require("../utilities/index");
const vscode_extension_tester_1 = require("vscode-extension-tester");
const chai_1 = require("chai");
describe('Deploy and Retrieve', async () => {
    let projectName;
    const pathToClass = path_1.default.join('force-app', 'main', 'default', 'classes', 'MyClass');
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: true,
        testSuiteSuffixName: 'DeployAndRetrieve'
    };
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        utilities.log(`Deploy and Retrieve - Set up the testing environment`);
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
        projectName = testSetup.tempProjectName;
        // Create Apex Class
        const classText = [
            `public with sharing class MyClass {`,
            ``,
            `\tpublic static void SayHello(string name){`,
            `\t\tSystem.debug('Hello, ' + name + '!');`,
            `\t}`,
            `}`
        ].join('\n');
        await utilities.dismissAllNotifications();
        await utilities.createApexClass('MyClass', classText);
        const workbench = utilities.getWorkbench();
        const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Create Apex Class successfully ran', utilities.Duration.TEN_MINUTES);
        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Finished SFDX: Create Apex Class', 10);
        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
        (0, chai_1.expect)(outputPanelText).to.contain(`${pathToClass}.cls`);
        (0, chai_1.expect)(outputPanelText).to.contain(`${pathToClass}.cls-meta.xml`);
        // Check for expected items in the Explorer view.
        const sidebar = workbench.getSideBar();
        const content = sidebar.getContent();
        const treeViewSection = await content.getSection(projectName);
        await treeViewSection.expand();
        // Get the matching (visible) items within the tree which contain "MyClass".
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'MyClass');
        // It's a tree, but it's also a list.  Everything in the view is actually flat
        // and returned from the call to visibleItems.reduce().
        (0, chai_1.expect)(filteredTreeViewItems.includes('MyClass.cls')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('MyClass.cls-meta.xml')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify Source Tracking Setting is enabled', async () => {
        utilities.log(`Deploy and Retrieve - Verify Source Tracking Setting is enabled`);
        (0, chai_1.expect)(await utilities.isBooleanSettingEnabled(index_1.WORKSPACE_SETTING_KEYS.ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE));
    });
    (0, mocha_steps_1.step)('Deploy with SFDX: Deploy This Source to Org - ST enabled', async () => {
        utilities.log(`Deploy and Retrieve - Deploy with SFDX: Deploy This Source to Org - ST enabled`);
        const workbench = utilities.getWorkbench();
        // Clear the Output view first.
        await utilities.clearOutputView(utilities.Duration.seconds(2));
        await utilities.getTextEditor(workbench, 'MyClass.cls');
        await runAndValidateCommand('Deploy', 'to', 'ST');
    });
    (0, mocha_steps_1.step)('Deploy again (with no changes) - ST enabled', async () => {
        utilities.log(`Deploy and Retrieve - Deploy again (with no changes) - ST enabled`);
        const workbench = utilities.getWorkbench();
        // Clear the Output view first.
        await utilities.clearOutputView(utilities.Duration.seconds(2));
        await utilities.getTextEditor(workbench, 'MyClass.cls');
        await runAndValidateCommand('Deploy', 'to', 'ST', 'Unchanged  ');
    });
    (0, mocha_steps_1.step)('Modify the file and deploy again - ST enabled', async () => {
        utilities.log(`Deploy and Retrieve - Modify the file and deploy again - ST enabled`);
        const workbench = utilities.getWorkbench();
        // Clear the Output view first.
        await utilities.clearOutputView(utilities.Duration.seconds(2));
        // Modify the file by adding a comment.
        const textEditor = await utilities.getTextEditor(workbench, 'MyClass.cls');
        await textEditor.setTextAtLine(2, '\t//say hello to a given name');
        await textEditor.save();
        // Deploy running SFDX: Deploy This Source to Org
        await runAndValidateCommand('Deploy', 'to', 'ST', 'Changed  ');
    });
    (0, mocha_steps_1.step)('Retrieve with SFDX: Retrieve This Source from Org', async () => {
        utilities.log(`Deploy and Retrieve - Retrieve with SFDX: Retrieve This Source from Org`);
        const workbench = utilities.getWorkbench();
        // Clear the Output view first.
        await utilities.clearOutputView(utilities.Duration.seconds(2));
        await utilities.getTextEditor(workbench, 'MyClass.cls');
        await runAndValidateCommand('Retrieve', 'from', 'ST');
    });
    (0, mocha_steps_1.step)('Modify the file and retrieve again', async () => {
        utilities.log(`Deploy and Retrieve - Modify the file and retrieve again`);
        const workbench = utilities.getWorkbench();
        // Clear the Output view first.
        await utilities.clearOutputView(utilities.Duration.seconds(2));
        // Modify the file by changing the comment.
        const textEditor = await utilities.getTextEditor(workbench, 'MyClass.cls');
        await textEditor.setTextAtLine(2, '\t//modified comment');
        await textEditor.save();
        // Retrieve running SFDX: Retrieve This Source from Org
        await runAndValidateCommand('Retrieve', 'from', 'ST');
        // Retrieve operation will overwrite the file, hence the the comment will remain as before the modification
        const textAfterRetrieve = await textEditor.getText();
        (0, chai_1.expect)(textAfterRetrieve).to.not.contain('modified comment');
    });
    (0, mocha_steps_1.step)('Prefer Deploy on Save when `Push or deploy on save` is enabled', async () => {
        utilities.log(`Deploy and Retrieve - Prefer Deploy on Save when 'Push or deploy on save' is enabled`);
        const workbench = utilities.getWorkbench();
        // Clear the Output view first.
        await utilities.clearOutputView(utilities.Duration.seconds(2));
        (0, chai_1.expect)(await utilities.enableBooleanSetting(index_1.WORKSPACE_SETTING_KEYS.PUSH_OR_DEPLOY_ON_SAVE_ENABLED)).to.equal(true);
        await utilities.pause(utilities.Duration.seconds(3));
        (0, chai_1.expect)(await utilities.enableBooleanSetting(index_1.WORKSPACE_SETTING_KEYS.PUSH_OR_DEPLOY_ON_SAVE_PREFER_DEPLOY_ON_SAVE)).to.equal(true);
        // Clear all notifications so clear output button is reachable
        await utilities.executeQuickPick('Notifications: Clear All Notifications', utilities.Duration.seconds(1));
        // Clear the Output view first.
        await utilities.clearOutputView(utilities.Duration.seconds(2));
        // Modify the file and save to trigger deploy
        const textEditor = await utilities.getTextEditor(workbench, 'MyClass.cls');
        await textEditor.setTextAtLine(2, `\t// let's trigger deploy`);
        await textEditor.save();
        await utilities.pause(utilities.Duration.seconds(5));
        // At this point there should be no conflicts since this is a new class.
        await validateCommand('Deploy', 'to', 'on save');
    });
    (0, mocha_steps_1.step)('Disable Source Tracking Setting', async () => {
        utilities.log(`Deploy and Retrieve - Disable Source Tracking Setting`);
        await utilities.executeQuickPick('Notifications: Clear All Notifications', utilities.Duration.seconds(1));
        (0, chai_1.expect)(await utilities.disableBooleanSetting(index_1.WORKSPACE_SETTING_KEYS.ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE)).to.equal(false);
        // Reload window to update cache and get the setting behavior to work
        await utilities.reloadWindow();
        await utilities.verifyExtensionsAreRunning(utilities.getExtensionsToVerifyActive(), utilities.Duration.seconds(100));
    });
    (0, mocha_steps_1.step)('Deploy with SFDX: Deploy This Source to Org - ST disabled', async () => {
        utilities.log(`Deploy and Retrieve - Deploy with SFDX: Deploy This Source to Org - ST disabled`);
        const workbench = utilities.getWorkbench();
        // Clear all notifications so clear output button is visible
        await utilities.executeQuickPick('Notifications: Clear All Notifications');
        // Clear the Output view first.
        await utilities.clearOutputView(utilities.Duration.seconds(2));
        await utilities.getTextEditor(workbench, 'MyClass.cls');
        await runAndValidateCommand('Deploy', 'to', 'no-ST');
    });
    (0, mocha_steps_1.step)('Deploy again (with no changes) - ST disabled', async () => {
        utilities.log(`Deploy and Retrieve - Deploy again (with no changes) - ST enabled`);
        const workbench = utilities.getWorkbench();
        // Clear the Output view first.
        await utilities.clearOutputView(utilities.Duration.seconds(2));
        await utilities.getTextEditor(workbench, 'MyClass.cls');
        await runAndValidateCommand('Deploy', 'to', 'no-ST', 'Unchanged  ');
    });
    (0, mocha_steps_1.step)('Modify the file and deploy again - ST disabled', async () => {
        utilities.log(`Deploy and Retrieve - Modify the file and deploy again - ST disabled`);
        const workbench = utilities.getWorkbench();
        // Clear the Output view first.
        await utilities.clearOutputView(utilities.Duration.seconds(2));
        // Modify the file by adding a comment.
        const textEditor = await utilities.getTextEditor(workbench, 'MyClass.cls');
        await textEditor.setTextAtLine(2, '\t//say hello to a given name');
        await textEditor.save();
        // Deploy running SFDX: Deploy This Source to Org
        await runAndValidateCommand('Deploy', 'to', 'no-ST', 'Changed  ');
    });
    (0, mocha_steps_1.step)('SFDX: Delete This from Project and Org', async () => {
        if (process.platform !== 'linux') {
            utilities.log(`Deploy and Retrieve - SFDX: Delete This from Project and Org`);
            const workbench = utilities.getWorkbench();
            await utilities.getTextEditor(workbench, 'MyClass.cls');
            // Run SFDX: Push Source to Default Org and Ignore Conflicts to be in sync with remote
            await utilities.executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', utilities.Duration.seconds(10));
            // Clear the Output view first.
            await utilities.clearOutputView();
            // clear notifications
            await utilities.dismissAllNotifications();
            await utilities.executeQuickPick('SFDX: Delete This from Project and Org', utilities.Duration.seconds(2));
            // Make sure we get a notification for the source delete
            const notificationFound = await utilities.notificationIsPresentWithTimeout('Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?', utilities.Duration.ONE_MINUTE);
            (0, chai_1.expect)(notificationFound).to.equal(true);
            // Confirm deletion
            const accepted = await utilities.acceptNotification('Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?', 'Delete Source', utilities.Duration.seconds(5));
            (0, chai_1.expect)(accepted).to.equal(true);
            const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Delete from Project and Org successfully ran', utilities.Duration.TEN_MINUTES);
            (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
            // TODO: see how the test can accommodate the new output from CLI.
            // Verify Output tab
            const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Delete from Project and Org', 10);
            utilities.log('Output panel text is: ' + outputPanelText);
            const expectedTexts = [
                '=== Deleted Source',
                'MyClass',
                'ApexClass',
                `${path_1.default.join(pathToClass)}.cls`,
                `${path_1.default.join(pathToClass)}.cls-meta.xml`,
                'ended with exit code 0'
            ];
            (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
            await utilities.verifyOutputPanelText(outputPanelText, expectedTexts);
        }
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        utilities.log(`Deploy and Retrieve - Tear down and clean up the testing environment`);
        await testSetup?.tearDown();
    });
    const runAndValidateCommand = async (operation, fromTo, type, prefix) => {
        utilities.log(`runAndValidateCommand()`);
        await utilities.executeQuickPick(`SFDX: ${operation} This Source ${fromTo} Org`, utilities.Duration.seconds(5));
        await validateCommand(operation, fromTo, type, prefix);
    };
    const validateCommand = async (operation, fromTo, type, // Text to identify operation type (if it has source tracking enabled, disabled or if it was a deploy on save)
    prefix = '') => {
        utilities.log(`validateCommand()`);
        const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(`SFDX: ${operation} This Source ${fromTo} Org successfully ran`, utilities.Duration.TEN_MINUTES);
        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        // Verify Output tab
        const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', `Starting SFDX: ${operation} This Source ${fromTo}`, 10);
        utilities.log(`${operation} time ${type}: ` + (await utilities.getOperationTime(outputPanelText)));
        const expectedTexts = [
            `${operation}ed Source`.replace('Retrieveed', 'Retrieved'),
            `${prefix}MyClass    ApexClass  ${pathToClass}.cls`,
            `${prefix}MyClass    ApexClass  ${pathToClass}.cls-meta.xml`,
            `ended SFDX: ${operation} This Source ${fromTo} Org`
        ];
        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
        await utilities.verifyOutputPanelText(outputPanelText, expectedTexts);
    };
});
//# sourceMappingURL=deployAndRetrieve.e2e.js.map