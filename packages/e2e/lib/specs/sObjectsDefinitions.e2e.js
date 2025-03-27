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
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const mocha_steps_1 = require("mocha-steps");
const vscode_extension_tester_1 = require("vscode-extension-tester");
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
const chai_1 = require("chai");
describe('SObjects Definitions', async () => {
    let testSetup;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: true,
        testSuiteSuffixName: 'sObjectsDefinitions'
    };
    let projectName;
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
        projectName = testSetup.tempProjectName;
        utilities.log(`${testSetup.testSuiteSuffixName} - calling createCustomObjects()`);
        await utilities.createCustomObjects(testSetup);
    });
    (0, mocha_steps_1.step)(`Check Custom Objects 'Customer__c' and 'Product__c' are within objects folder`, async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Check Custom Objects 'Customer__c' and 'Product__c' are within objects folder`);
        const workbench = await utilities.getWorkbench();
        const sidebar = await workbench.getSideBar().wait();
        const content = await sidebar.getContent().wait();
        const treeViewSection = await content.getSection(projectName);
        (0, chai_1.expect)(treeViewSection).to.not.be.undefined;
        const objectTreeItem = (await treeViewSection.findItem('objects'));
        (0, chai_1.expect)(objectTreeItem).to.not.be.undefined;
        await objectTreeItem.select();
        const customerObjectFolder = (await objectTreeItem.findChildItem('Customer__c'));
        (0, chai_1.expect)(customerObjectFolder).to.not.be.undefined;
        await customerObjectFolder?.expand();
        (0, chai_1.expect)(await customerObjectFolder?.isExpanded()).to.equal(true);
        const customerCustomObject = await customerObjectFolder.findChildItem('Customer__c.object-meta.xml');
        (0, chai_1.expect)(customerCustomObject).to.not.be.undefined;
        const productObjectFolder = (await objectTreeItem.findChildItem('Product__c'));
        (0, chai_1.expect)(productObjectFolder).to.not.be.undefined;
        await productObjectFolder?.expand();
        (0, chai_1.expect)(await productObjectFolder?.isExpanded()).to.equal(true);
        const productCustomObject = await productObjectFolder.findChildItem('Product__c.object-meta.xml');
        (0, chai_1.expect)(productCustomObject).to.not.be.undefined;
    });
    (0, mocha_steps_1.step)('Push Source to Org', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Push Source to Org`);
        await utilities.executeQuickPick('SFDX: Push Source to Default Org', utilities.Duration.seconds(5));
        await utilities.pause(utilities.Duration.seconds(1));
        const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Push Source to Default Org successfully ran', utilities.Duration.TEN_MINUTES);
        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Push Source to Default Org', 5);
        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
        (0, chai_1.expect)(outputPanelText).to.contain('Pushed Source');
    });
    (0, mocha_steps_1.step)('Refresh SObject Definitions for Custom SObjects', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Refresh SObject Definitions for Custom SObjects`);
        await refreshSObjectDefinitions('Custom SObjects');
        await verifyOutputPanelText('Custom sObjects', 2);
        const workbench = await utilities.getWorkbench();
        const treeViewSection = await verifySObjectFolders(workbench, projectName, 'customObjects');
        // Verify if custom Objects Customer__c and Product__c are within 'customObjects' folder
        const customerCustomObject = await treeViewSection.findItem('Customer__c.cls');
        (0, chai_1.expect)(customerCustomObject).to.not.be.undefined;
        const productCustomObject = await treeViewSection.findItem('Product__c.cls');
        (0, chai_1.expect)(productCustomObject).to.not.be.undefined;
    });
    (0, mocha_steps_1.step)('Refresh SObject Definitions for Standard SObjects', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Refresh SObject Definitions for Standard SObjects`);
        await refreshSObjectDefinitions('Standard SObjects');
        await verifyOutputPanelText('Standard sObjects');
        const workbench = await utilities.getWorkbench();
        const treeViewSection = await verifySObjectFolders(workbench, projectName, 'standardObjects');
        const accountSObject = await treeViewSection.findItem('Account.cls');
        (0, chai_1.expect)(accountSObject).to.not.be.undefined;
        const accountCleanInfoSObject = await treeViewSection.findItem('AccountCleanInfo.cls');
        (0, chai_1.expect)(accountCleanInfoSObject).to.not.be.undefined;
        const acceptedEventRelationSObject = await treeViewSection.findItem('AcceptedEventRelation.cls');
        (0, chai_1.expect)(acceptedEventRelationSObject).to.not.be.undefined;
    });
    (0, mocha_steps_1.step)('Refresh SObject Definitions for All SObjects', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Refresh SObject Definitions for All SObjects`);
        await refreshSObjectDefinitions('All SObjects');
        await verifyOutputPanelText('Standard sObjects');
        await verifyOutputPanelText('Custom sObjects', 2);
    });
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        await testSetup?.tearDown();
    });
});
async function verifyOutputPanelText(type, qty) {
    utilities.log(`calling verifyOutputPanelText(${type})`);
    const outputPanelText = (await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'sObjects', 10));
    (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
    const expectedTexts = [
        `Starting SFDX: Refresh SObject Definitions`,
        `sf sobject definitions refresh`,
        `Processed ${qty || ''}`,
        `${type}`,
        `ended with exit code 0`
    ];
    await utilities.verifyOutputPanelText(outputPanelText, expectedTexts);
}
async function refreshSObjectDefinitions(type) {
    utilities.log(`calling refreshSObjectDefinitions(${type})`);
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    const prompt = await utilities.executeQuickPick('SFDX: Refresh SObject Definitions', utilities.Duration.seconds(2));
    await prompt.setText(type);
    await prompt.selectQuickPick(type);
    await utilities.pause(utilities.Duration.seconds(1));
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Refresh SObject Definitions successfully ran', utilities.Duration.TEN_MINUTES);
    (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
}
async function verifySObjectFolders(workbench, projectName, folder) {
    utilities.log(`calling verifySObjectFolders(workbench, ${projectName}, ${folder})`);
    const sidebar = workbench.getSideBar();
    const content = sidebar.getContent();
    const treeViewSection = await content.getSection(projectName);
    (0, chai_1.expect)(treeViewSection).to.not.be.undefined;
    // Verify if '.sfdx' folder is in side panel
    const sfdxTreeItem = (await treeViewSection.findItem('.sfdx'));
    (0, chai_1.expect)(sfdxTreeItem).to.not.be.undefined;
    await sfdxTreeItem.expand();
    (0, chai_1.expect)(await sfdxTreeItem.isExpanded()).to.equal(true);
    await utilities.pause(utilities.Duration.seconds(1));
    // Verify if 'tools' folder is within '.sfdx'
    const toolsTreeItem = (await sfdxTreeItem.findChildItem('tools'));
    (0, chai_1.expect)(toolsTreeItem).to.not.be.undefined;
    await toolsTreeItem.expand();
    (0, chai_1.expect)(await toolsTreeItem.isExpanded()).to.equal(true);
    await utilities.pause(utilities.Duration.seconds(1));
    // Verify if 'sobjects' folder is within 'tools'
    const sobjectsTreeItem = (await toolsTreeItem.findChildItem('sobjects'));
    (0, chai_1.expect)(sobjectsTreeItem).to.not.be.undefined;
    await sobjectsTreeItem.expand();
    (0, chai_1.expect)(await sobjectsTreeItem.isExpanded()).to.equal(true);
    await utilities.pause(utilities.Duration.seconds(1));
    // Verify if 'type' folder is within 'sobjects'
    const objectsTreeItem = (await sobjectsTreeItem.findChildItem(folder));
    (0, chai_1.expect)(objectsTreeItem).to.not.be.undefined;
    await objectsTreeItem.expand();
    (0, chai_1.expect)(await objectsTreeItem.isExpanded()).to.equal(true);
    await utilities.pause(utilities.Duration.seconds(1));
    return treeViewSection;
}
//# sourceMappingURL=sObjectsDefinitions.e2e.js.map