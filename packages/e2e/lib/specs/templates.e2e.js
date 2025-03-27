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
const chai_1 = require("chai");
const child_process_1 = __importDefault(require("child_process"));
const mocha_steps_1 = require("mocha-steps");
const path_1 = __importDefault(require("path"));
const util_1 = __importDefault(require("util"));
const vscode_extension_tester_1 = require("vscode-extension-tester");
const analyticsTemplate = __importStar(require("../testData/sampleAnalyticsTemplateData"));
const testSetup_1 = require("../testSetup");
const utilities = __importStar(require("../utilities/index"));
const exec = util_1.default.promisify(child_process_1.default.exec);
describe('Templates', async () => {
    let testSetup;
    let projectName;
    const testReqConfig = {
        projectConfig: {
            projectShape: utilities.ProjectShapeOption.NEW
        },
        isOrgRequired: false,
        testSuiteSuffixName: 'Templates'
    };
    // Set up
    (0, mocha_steps_1.step)('Set up the testing environment', async () => {
        utilities.log('Templates - Set up the testing environment');
        testSetup = await testSetup_1.TestSetup.setUp(testReqConfig);
        projectName = testSetup.tempProjectName;
    });
    // Apex Class
    (0, mocha_steps_1.step)('Create an Apex Class', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create an Apex Class`);
        // Using the Command palette, run SFDX: Create Apex Class.
        await utilities.createCommand('Apex Class', 'ApexClass1', 'classes', 'cls');
        // Check for expected items in the Explorer view.
        const workbench = await utilities.getWorkbench();
        // Get the matching (visible) items within the tree which contains "ApexClass1".
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'ApexClass1');
        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexClass1.cls')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexClass1.cls-meta.xml')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify the contents of the Apex Class', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Apex Class`);
        const expectedText = ['public with sharing class ApexClass1 {', '    public ApexClass1() {', '', '    }', '}'].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'ApexClass1.cls');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
    });
    // Apex Unit Test Class
    (0, mocha_steps_1.step)('Create an Apex Unit Test Class', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create an Apex Unit Test Class`);
        // Using the Command palette, run SFDX: Create Apex Unit Test Class.
        await utilities.createCommand('Apex Unit Test Class', 'ApexUnitTestClass1', 'classes', 'cls');
        // Check for expected items in the Explorer view.
        const workbench = await utilities.getWorkbench();
        // Get the matching (visible) items within the tree which contains "ApexUnitTestClass1".
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'ApexUnitTestClass1');
        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexUnitTestClass1.cls')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexUnitTestClass1.cls-meta.xml')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify the contents of the Apex Unit Test Class', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Apex Unit Test Class`);
        const expectedText = [
            '@isTest',
            'private class ApexUnitTestClass1 {',
            '',
            '    @isTest',
            '    static void myUnitTest() {',
            '        // TO DO: implement unit test',
            '    }',
            '}'
        ].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'ApexUnitTestClass1.cls');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.contain(expectedText);
    });
    // Apex Trigger
    (0, mocha_steps_1.step)('Create an Apex Trigger', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create an Apex Trigger`);
        // Using the Command palette, run "SFDX: Create Apex Trigger".
        await utilities.createCommand('Apex Trigger', 'ApexTrigger1', 'triggers', 'trigger');
        // Check for expected items in the Explorer view.
        const workbench = await utilities.getWorkbench();
        // Get the matching (visible) items within the tree which contains "ApexTrigger1".
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'ApexTrigger1');
        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexTrigger1.trigger')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('ApexTrigger1.trigger-meta.xml')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify the contents of the Apex Trigger', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Apex Trigger`);
        // Verify the default trigger.
        const expectedText = ['trigger ApexTrigger1 on SOBJECT (before insert) {', '', '}'].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'ApexTrigger1.trigger');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
    });
    // Aura App
    (0, mocha_steps_1.step)('Create an Aura App', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create an Aura App`);
        // Clear the output panel, then use the Command palette to run, "SFDX: Create Aura App".
        const outputPanelText = await utilities.createCommand('Aura App', 'AuraApp1', path_1.default.join('aura', 'AuraApp1'), 'app');
        const basePath = path_1.default.join('force-app', 'main', 'default', 'aura', 'AuraApp1');
        const docPath = path_1.default.join(basePath, 'AuraApp1.auradoc');
        (0, chai_1.expect)(outputPanelText).to.contain(`create ${docPath}`);
        const cssPath = path_1.default.join(basePath, 'AuraApp1.css');
        (0, chai_1.expect)(outputPanelText).to.contain(`create ${cssPath}`);
        const svgPath = path_1.default.join(basePath, 'AuraApp1.svg');
        (0, chai_1.expect)(outputPanelText).to.contain(`create ${svgPath}`);
        const controllerPath = path_1.default.join(basePath, 'AuraApp1Controller.js');
        (0, chai_1.expect)(outputPanelText).to.contain(`create ${controllerPath}`);
        const helperPath = path_1.default.join(basePath, 'AuraApp1Helper.js');
        (0, chai_1.expect)(outputPanelText).to.contain(`create ${helperPath}`);
        const rendererPath = path_1.default.join(basePath, 'AuraApp1Renderer.js');
        (0, chai_1.expect)(outputPanelText).to.contain(`create ${rendererPath}`);
        // Get the matching (visible) items within the tree which contains "AuraApp1".
        const workbench = await utilities.getWorkbench();
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'AuraApp1');
        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1.app')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1.app-meta.xml')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1.auradoc')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1.css')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1.svg')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1Controller.js')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1Helper.js')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraApp1Renderer.js')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify the contents of the Aura App', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura App`);
        // Verify the default code for an Aura App.
        const expectedText = ['<aura:application>', '', '</aura:application>'].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'AuraApp1.app');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
    });
    // Aura Component
    (0, mocha_steps_1.step)('Create an Aura Component', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create an Aura Component`);
        // Using the Command palette, run SFDX: Create Aura Component.
        await utilities.createCommand('Aura Component', 'auraComponent1', path_1.default.join('aura', 'auraComponent1'), 'cmp');
        // Zoom out so all tree items are visible
        const workbench = await utilities.getWorkbench();
        await utilities.zoom('Out', 1, utilities.Duration.seconds(2));
        // Check for the presence of the directory, "auraComponent1".
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'auraComponent1');
        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1')).to.equal(true);
        // It's a tree, but it's also a list.  Everything in the view is actually flat
        // and returned from the call to visibleItems.reduce().
        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1.cmp')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1.cmp-meta.xml')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1Controller.js')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1Helper.js')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('auraComponent1Renderer.js')).to.equal(true);
        // Could also check for .auradoc, .css, .design, and .svg, but not as critical
        // and since this could change w/o our knowing, only check for what we need to here.
    });
    (0, mocha_steps_1.step)('Verify the contents of the Aura Component', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura Component`);
        const expectedText = ['<aura:component>', '', '</aura:component>'].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'auraComponent1.cmp');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
    });
    // Aura Event
    (0, mocha_steps_1.step)('Create an Aura Event', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create an Aura Event`);
        // Using the Command palette, run SFDX: Create Aura Component.
        await utilities.createCommand('Aura Event', 'auraEvent1', path_1.default.join('aura', 'auraEvent1'), 'evt');
        // Check for expected items in the Explorer view.
        const workbench = await utilities.getWorkbench();
        // Check for the presence of the directory, "auraEvent1".
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'auraEvent1');
        (0, chai_1.expect)(filteredTreeViewItems.includes('auraEvent1')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('auraEvent1.evt')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('auraEvent1.evt-meta.xml')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify the contents of the Aura Event', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura Event`);
        const expectedText = ['<aura:event type="APPLICATION" description="Event template" />'].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'auraEvent1.evt');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
    });
    // Aura Interface
    (0, mocha_steps_1.step)('Create an Aura Interface', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create an Aura Interface`);
        // Using the Command palette, run "SFDX: Create Aura Interface".
        await utilities.createCommand('Aura Interface', 'AuraInterface1', path_1.default.join('aura', 'AuraInterface1'), 'intf');
        // Get the matching (visible) items within the tree which contains "AuraInterface1".
        const workbench = await utilities.getWorkbench();
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'AuraInterface1');
        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraInterface1.intf')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('AuraInterface1.intf-meta.xml')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify the contents of the Aura Interface', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura Interface`);
        // Verify the default code for an Aura Interface.
        const expectedText = [
            '<aura:interface description="Interface template">',
            '  <aura:attribute name="example" type="String" default="" description="An example attribute."/>',
            '</aura:interface>'
        ].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'AuraInterface1.intf');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
    });
    // Lightning Web Component
    (0, mocha_steps_1.step)('Create Lightning Web Component', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create Lightning Web Component`);
        // Using the Command palette, run SFDX: Create Lightning Web Component.
        await utilities.createCommand('Lightning Web Component', 'lightningWebComponent1', path_1.default.join('lwc', 'lightningWebComponent1'), 'js');
        // Check for expected items in the Explorer view.
        const workbench = await utilities.getWorkbench();
        // Check for the presence of the directory, "lightningWebComponent1".
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'lightningWebComponent1');
        (0, chai_1.expect)(filteredTreeViewItems.includes('lightningWebComponent1')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('lightningWebComponent1.html')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('lightningWebComponent1.js')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('lightningWebComponent1.js-meta.xml')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify the contents of the Lightning Web Component', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Lightning Web Component`);
        const expectedText = [
            "import { LightningElement } from 'lwc';",
            '',
            'export default class LightningWebComponent1 extends LightningElement {}'
        ].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'lightningWebComponent1.js');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
    });
    // Lightning Web Component Test
    (0, mocha_steps_1.xstep)('Create Lightning Web Component Test', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create Lightning Web Component Test`);
        // Delete previous test file
        const workbench = await utilities.getWorkbench();
        const pathToLwcTest = path_1.default.join('force-app', 'main', 'default', 'lwc', 'lightningWebComponent1', '__tests__', 'lightningWebComponent1.test.js');
        exec(process.platform === 'win32' ? `del ${pathToLwcTest}` : `rm ${pathToLwcTest}`, {
            cwd: testSetup.projectFolderPath
        });
        // Using the Command palette, run SFDX: Create Lightning Web Component Test.
        const inputBox = await utilities.executeQuickPick('SFDX: Create Lightning Web Component Test', utilities.Duration.seconds(1));
        // Set the name of the new test to lightningWebComponent1.
        await inputBox.confirm();
        await inputBox.setText('lightningWebComponent1');
        await inputBox.confirm();
        await utilities.pause(utilities.Duration.seconds(60));
        const failureNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Create Lightning Web Component Test failed to run', utilities.Duration.TEN_MINUTES);
        (0, chai_1.expect)(failureNotificationWasFound).to.equal(true);
        const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Starting SFDX: Create Lightning Web Component Test', 10);
        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
        // Check for expected item in the Explorer view.
        await utilities.getTextEditor(workbench, 'lightningWebComponent1.test.js');
        const treeViewSection = await utilities.expandProjectInSideBar(workbench, projectName);
        const lwcTestFolder = await treeViewSection.findItem('__tests__');
        await lwcTestFolder?.select();
        const testItem = await treeViewSection.findItem('lightningWebComponent1.test.js');
        (0, chai_1.expect)(testItem).to.not.be.undefined;
    });
    (0, mocha_steps_1.xstep)('Verify the contents of the Lightning Web Component Test', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Lightning Web Component Test`);
        const expectedText = [
            "import { createElement } from 'lwc';",
            "import LightningWebComponent1 from 'c/lightningWebComponent1';",
            '',
            "describe('c-lightning-web-component1', () => {",
            '    afterEach(() => {',
            '        // The jsdom instance is shared across test cases in a single file so reset the DOM',
            '        while (document.body.firstChild) {',
            '            document.body.removeChild(document.body.firstChild);',
            '        }',
            '    });',
            '',
            "    it('TODO: test case generated by CLI command, please fill in test logic', () => {",
            "        const element = createElement('c-lightning-web-component1', {",
            '            is: LightningWebComponent1',
            '        });',
            '        document.body.appendChild(element);',
            '        expect(1).toBe(2);',
            '    });',
            '});'
        ].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'lightningWebComponent1.test.js');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
    });
    // Visualforce Component
    (0, mocha_steps_1.step)('Create a Visualforce Component', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create a Visualforce Component`);
        // Using the Command palette, run "SFDX: Create Visualforce Component".
        await utilities.createCommand('Visualforce Component', 'VisualforceCmp1', 'components', 'component');
        // Get the matching (visible) items within the tree which contains "AuraInterface1".
        const workbench = await utilities.getWorkbench();
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'VisualforceCmp1');
        (0, chai_1.expect)(filteredTreeViewItems.includes('VisualforceCmp1.component')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('VisualforceCmp1.component-meta.xml')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify the contents of the Visualforce Component', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Visualforce Component`);
        // Verify the default code for a Visualforce Component.
        const expectedText = [
            '<apex:component >',
            '<!-- Begin Default Content REMOVE THIS -->',
            '<h1>Congratulations</h1>',
            'This is your new Component',
            '<!-- End Default Content REMOVE THIS -->',
            '</apex:component>'
        ].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'VisualforceCmp1.component');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
    });
    // Visualforce Page
    (0, mocha_steps_1.step)('Create a Visualforce Page', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create a Visualforce Page`);
        // Using the Command palette, run "SFDX: Create Visualforce Page".
        await utilities.createCommand('Visualforce Page', 'VisualforcePage1', 'pages', 'page');
        // Get the matching (visible) items within the tree which contains "AuraInterface1".
        const workbench = await utilities.getWorkbench();
        const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'VisualforcePage1');
        (0, chai_1.expect)(filteredTreeViewItems.includes('VisualforcePage1.page')).to.equal(true);
        (0, chai_1.expect)(filteredTreeViewItems.includes('VisualforcePage1.page-meta.xml')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify the contents of the Visualforce Page', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Visualforce Page`);
        // Verify the default code for a Visualforce Page.
        const expectedText = [
            '<apex:page >',
            '<!-- Begin Default Content REMOVE THIS -->',
            '<h1>Congratulations</h1>',
            'This is your new Page',
            '<!-- End Default Content REMOVE THIS -->',
            '</apex:page>'
        ].join('\n');
        const workbench = await utilities.getWorkbench();
        const textEditor = await utilities.getTextEditor(workbench, 'VisualforcePage1.page');
        const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(expectedText);
    });
    // Sample Analytics Template
    (0, mocha_steps_1.step)('Create a Sample Analytics Template', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Create a Sample Analytics Template`);
        // Clear the output panel, then use the Command palette to run, "SFDX: Create Sample Analytics Template".
        const workbench = await utilities.getWorkbench();
        await utilities.clearOutputView();
        const inputBox = await utilities.executeQuickPick('SFDX: Create Sample Analytics Template', utilities.Duration.seconds(1));
        // Set the name of the new page to sat1
        await inputBox.setText('sat1');
        await inputBox.confirm();
        await utilities.pause(utilities.Duration.seconds(1));
        // Select the default directory (press Enter/Return).
        await inputBox.confirm();
        const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout('SFDX: Create Sample Analytics Template successfully ran', utilities.Duration.TEN_MINUTES);
        (0, chai_1.expect)(successNotificationWasFound).to.equal(true);
        const outputPanelText = await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'Finished SFDX: Create Sample Analytics Template', 10);
        (0, chai_1.expect)(outputPanelText).to.not.be.undefined;
        // Check for expected items in the Explorer view.
        // Check for the presence of the corresponding files
        const treeViewItems = await utilities.getVisibleItemsFromSidebar(workbench, projectName);
        (0, chai_1.expect)(treeViewItems.includes('dashboards')).to.equal(true);
        (0, chai_1.expect)(treeViewItems.includes('app-to-template-rules.json')).to.equal(true);
        (0, chai_1.expect)(treeViewItems.includes('folder.json')).to.equal(true);
        (0, chai_1.expect)(treeViewItems.includes('releaseNotes.html')).to.equal(true);
        (0, chai_1.expect)(treeViewItems.includes('template-info.json')).to.equal(true);
        (0, chai_1.expect)(treeViewItems.includes('template-to-app-rules.json')).to.equal(true);
        (0, chai_1.expect)(treeViewItems.includes('ui.json')).to.equal(true);
        (0, chai_1.expect)(treeViewItems.includes('variables.json')).to.equal(true);
    });
    (0, mocha_steps_1.step)('Verify the contents of the Sample Analytics Template', async () => {
        utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Sample Analytics Template`);
        // Verify the default code for a Sample Analytics Template.
        const workbench = await utilities.getWorkbench();
        let textEditor = await utilities.getTextEditor(workbench, 'app-to-template-rules.json');
        let textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.appToTemplateRules);
        textEditor = await utilities.getTextEditor(workbench, 'folder.json');
        textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.folder);
        textEditor = await utilities.getTextEditor(workbench, 'releaseNotes.html');
        textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.releaseNotes);
        textEditor = await utilities.getTextEditor(workbench, 'template-info.json');
        textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.templateInfo);
        textEditor = await utilities.getTextEditor(workbench, 'template-to-app-rules.json');
        textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.templateToAppRules);
        textEditor = await utilities.getTextEditor(workbench, 'ui.json');
        textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.ui);
        textEditor = await utilities.getTextEditor(workbench, 'variables.json');
        textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
        (0, chai_1.expect)(textGeneratedFromTemplate).to.equal(analyticsTemplate.variables);
    });
    // Tear down
    (0, vscode_extension_tester_1.after)('Tear down and clean up the testing environment', async () => {
        await testSetup?.tearDown();
    });
});
//# sourceMappingURL=templates.e2e.js.map