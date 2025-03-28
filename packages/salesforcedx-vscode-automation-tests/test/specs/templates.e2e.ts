/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import child_process from 'child_process';
import { step } from 'mocha-steps';
import path from 'path';
import util from 'util';
import { TestSetup } from '../testSetup';
import * as utilities from '../utilities/index';
import * as analyticsTemplate from '../testData/sampleAnalyticsTemplateData';
import { expect } from 'chai';
import { after } from 'vscode-extension-tester';

const exec = util.promisify(child_process.exec);

describe('Templates', async () => {
  let testSetup: TestSetup;
  let projectName: string;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'Templates'
  };

  // Set up
  step('Set up the testing environment', async () => {
    utilities.log(`Templates - Set up the testing environment`);
    testSetup = await TestSetup.setUp(testReqConfig);
    projectName = testSetup.tempProjectName;
  });

  // Apex Class
  step('Create an Apex Class', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create an Apex Class`);
    // Using the Command palette, run SFDX: Create Apex Class.
    await utilities.createCommand('Apex Class', 'ApexClass1', 'classes', 'cls');

    // Check for expected items in the Explorer view.
    const workbench = await utilities.getWorkbench();

    // Get the matching (visible) items within the tree which contains "ApexClass1".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'ApexClass1'
    );

    expect(filteredTreeViewItems.includes('ApexClass1.cls')).to.equal(true);
    expect(filteredTreeViewItems.includes('ApexClass1.cls-meta.xml')).to.equal(true);
  });

  step('Verify the contents of the Apex Class', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Apex Class`);
    const expectedText = ['public with sharing class ApexClass1 {', '    public ApexClass1() {', '', '    }', '}'].join(
      '\n'
    );
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'ApexClass1.cls');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Apex Unit Test Class
  step('Create an Apex Unit Test Class', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create an Apex Unit Test Class`);
    // Using the Command palette, run SFDX: Create Apex Unit Test Class.
    await utilities.createCommand('Apex Unit Test Class', 'ApexUnitTestClass1', 'classes', 'cls');

    // Check for expected items in the Explorer view.
    const workbench = await utilities.getWorkbench();

    // Get the matching (visible) items within the tree which contains "ApexUnitTestClass1".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'ApexUnitTestClass1'
    );

    expect(filteredTreeViewItems.includes('ApexUnitTestClass1.cls')).to.equal(true);
    expect(filteredTreeViewItems.includes('ApexUnitTestClass1.cls-meta.xml')).to.equal(true);
  });

  step('Verify the contents of the Apex Unit Test Class', async () => {
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
    expect(textGeneratedFromTemplate).to.contain(expectedText);
  });

  // Apex Trigger
  step('Create an Apex Trigger', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create an Apex Trigger`);
    // Using the Command palette, run "SFDX: Create Apex Trigger".
    await utilities.createCommand('Apex Trigger', 'ApexTrigger1', 'triggers', 'trigger');

    // Check for expected items in the Explorer view.
    const workbench = await utilities.getWorkbench();

    // Get the matching (visible) items within the tree which contains "ApexTrigger1".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'ApexTrigger1'
    );
    expect(filteredTreeViewItems.includes('ApexTrigger1.trigger')).to.equal(true);
    expect(filteredTreeViewItems.includes('ApexTrigger1.trigger-meta.xml')).to.equal(true);
  });

  step('Verify the contents of the Apex Trigger', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Apex Trigger`);
    // Verify the default trigger.
    const expectedText = ['trigger ApexTrigger1 on SOBJECT (before insert) {', '', '}'].join('\n');
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'ApexTrigger1.trigger');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Aura App
  step('Create an Aura App', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create an Aura App`);
    // Clear the output panel, then use the Command palette to run, "SFDX: Create Aura App".
    const outputPanelText = await utilities.createCommand('Aura App', 'AuraApp1', path.join('aura', 'AuraApp1'), 'app');
    const basePath = path.join('force-app', 'main', 'default', 'aura', 'AuraApp1');
    const docPath = path.join(basePath, 'AuraApp1.auradoc');
    expect(outputPanelText).to.contain(`create ${docPath}`);

    const cssPath = path.join(basePath, 'AuraApp1.css');
    expect(outputPanelText).to.contain(`create ${cssPath}`);

    const svgPath = path.join(basePath, 'AuraApp1.svg');
    expect(outputPanelText).to.contain(`create ${svgPath}`);

    const controllerPath = path.join(basePath, 'AuraApp1Controller.js');
    expect(outputPanelText).to.contain(`create ${controllerPath}`);

    const helperPath = path.join(basePath, 'AuraApp1Helper.js');
    expect(outputPanelText).to.contain(`create ${helperPath}`);

    const rendererPath = path.join(basePath, 'AuraApp1Renderer.js');
    expect(outputPanelText).to.contain(`create ${rendererPath}`);

    // Get the matching (visible) items within the tree which contains "AuraApp1".
    const workbench = await utilities.getWorkbench();
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'AuraApp1'
    );
    expect(filteredTreeViewItems.includes('AuraApp1.app')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1.app-meta.xml')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1.auradoc')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1.css')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1.svg')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1Controller.js')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1Helper.js')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1Renderer.js')).to.equal(true);
  });

  step('Verify the contents of the Aura App', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura App`);
    // Verify the default code for an Aura App.
    const expectedText = ['<aura:application>', '', '</aura:application>'].join('\n');
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'AuraApp1.app');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Aura Component
  step('Create an Aura Component', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create an Aura Component`);
    // Using the Command palette, run SFDX: Create Aura Component.
    await utilities.createCommand('Aura Component', 'auraComponent1', path.join('aura', 'auraComponent1'), 'cmp');
    // Zoom out so all tree items are visible
    const workbench = await utilities.getWorkbench();
    await utilities.zoom('Out', 1, utilities.Duration.seconds(2));
    // Check for the presence of the directory, "auraComponent1".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'auraComponent1'
    );
    expect(filteredTreeViewItems.includes('auraComponent1')).to.equal(true);

    // It's a tree, but it's also a list.  Everything in the view is actually flat
    // and returned from the call to visibleItems.reduce().
    expect(filteredTreeViewItems.includes('auraComponent1.cmp')).to.equal(true);
    expect(filteredTreeViewItems.includes('auraComponent1.cmp-meta.xml')).to.equal(true);
    expect(filteredTreeViewItems.includes('auraComponent1Controller.js')).to.equal(true);
    expect(filteredTreeViewItems.includes('auraComponent1Helper.js')).to.equal(true);
    expect(filteredTreeViewItems.includes('auraComponent1Renderer.js')).to.equal(true);

    // Could also check for .auradoc, .css, .design, and .svg, but not as critical
    // and since this could change w/o our knowing, only check for what we need to here.
  });

  step('Verify the contents of the Aura Component', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura Component`);
    const expectedText = ['<aura:component>', '', '</aura:component>'].join('\n');
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'auraComponent1.cmp');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Aura Event
  step('Create an Aura Event', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create an Aura Event`);
    // Using the Command palette, run SFDX: Create Aura Component.
    await utilities.createCommand('Aura Event', 'auraEvent1', path.join('aura', 'auraEvent1'), 'evt');

    // Check for expected items in the Explorer view.
    const workbench = await utilities.getWorkbench();

    // Check for the presence of the directory, "auraEvent1".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'auraEvent1'
    );
    expect(filteredTreeViewItems.includes('auraEvent1')).to.equal(true);
    expect(filteredTreeViewItems.includes('auraEvent1.evt')).to.equal(true);
    expect(filteredTreeViewItems.includes('auraEvent1.evt-meta.xml')).to.equal(true);
  });

  step('Verify the contents of the Aura Event', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura Event`);
    const expectedText = ['<aura:event type="APPLICATION" description="Event template" />'].join('\n');
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'auraEvent1.evt');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Aura Interface
  step('Create an Aura Interface', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create an Aura Interface`);
    // Using the Command palette, run "SFDX: Create Aura Interface".
    await utilities.createCommand('Aura Interface', 'AuraInterface1', path.join('aura', 'AuraInterface1'), 'intf');

    // Get the matching (visible) items within the tree which contains "AuraInterface1".
    const workbench = await utilities.getWorkbench();
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'AuraInterface1'
    );

    expect(filteredTreeViewItems.includes('AuraInterface1.intf')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraInterface1.intf-meta.xml')).to.equal(true);
  });

  step('Verify the contents of the Aura Interface', async () => {
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
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Lightning Web Component
  step('Create Lightning Web Component', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create Lightning Web Component`);
    // Using the Command palette, run SFDX: Create Lightning Web Component.
    await utilities.createCommand(
      'Lightning Web Component',
      'lightningWebComponent1',
      path.join('lwc', 'lightningWebComponent1'),
      'js'
    );

    // Check for expected items in the Explorer view.
    const workbench = await utilities.getWorkbench();

    // Check for the presence of the directory, "lightningWebComponent1".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'lightningWebComponent1'
    );
    expect(filteredTreeViewItems.includes('lightningWebComponent1')).to.equal(true);
    expect(filteredTreeViewItems.includes('lightningWebComponent1.html')).to.equal(true);
    expect(filteredTreeViewItems.includes('lightningWebComponent1.js')).to.equal(true);
    expect(filteredTreeViewItems.includes('lightningWebComponent1.js-meta.xml')).to.equal(true);
  });

  step('Verify the contents of the Lightning Web Component', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Lightning Web Component`);
    const expectedText = [
      `import { LightningElement } from 'lwc';`,
      '',
      'export default class LightningWebComponent1 extends LightningElement {}'
    ].join('\n');
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'lightningWebComponent1.js');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Lightning Web Component Test
  xstep('Create Lightning Web Component Test', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create Lightning Web Component Test`);
    // Delete previous test file
    const workbench = await utilities.getWorkbench();
    const pathToLwcTest = path.join(
      'force-app',
      'main',
      'default',
      'lwc',
      'lightningWebComponent1',
      '__tests__',
      'lightningWebComponent1.test.js'
    );
    exec(process.platform == 'win32' ? `del ${pathToLwcTest}` : `rm ${pathToLwcTest}`, {
      cwd: testSetup.projectFolderPath
    });

    // Using the Command palette, run SFDX: Create Lightning Web Component Test.
    const inputBox = await utilities.executeQuickPick(
      'SFDX: Create Lightning Web Component Test',
      utilities.Duration.seconds(1)
    );

    // Set the name of the new test to lightningWebComponent1.
    await inputBox.confirm();
    await inputBox.setText('lightningWebComponent1');
    await inputBox.confirm();
    await utilities.pause(utilities.Duration.seconds(60));

    const failureNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Create Lightning Web Component Test failed to run/,
      utilities.Duration.TEN_MINUTES
    );
    expect(failureNotificationWasFound).to.equal(true);

    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Create Lightning Web Component Test',
      10
    );
    expect(outputPanelText).to.not.be.undefined;

    // Check for expected item in the Explorer view.
    await utilities.getTextEditor(workbench, 'lightningWebComponent1.test.js');
    const treeViewSection = await utilities.expandProjectInSideBar(workbench, projectName);
    const lwcTestFolder = await treeViewSection.findItem('__tests__');
    await lwcTestFolder?.select();
    const testItem = await treeViewSection.findItem('lightningWebComponent1.test.js');
    expect(testItem).to.not.be.undefined;
  });

  xstep('Verify the contents of the Lightning Web Component Test', async () => {
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
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Visualforce Component
  step('Create a Visualforce Component', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create a Visualforce Component`);
    // Using the Command palette, run "SFDX: Create Visualforce Component".
    await utilities.createCommand('Visualforce Component', 'VisualforceCmp1', 'components', 'component');
    // Get the matching (visible) items within the tree which contains "AuraInterface1".
    const workbench = await utilities.getWorkbench();
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'VisualforceCmp1'
    );
    expect(filteredTreeViewItems.includes('VisualforceCmp1.component')).to.equal(true);
    expect(filteredTreeViewItems.includes('VisualforceCmp1.component-meta.xml')).to.equal(true);
  });

  step('Verify the contents of the Visualforce Component', async () => {
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
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Visualforce Page
  step('Create a Visualforce Page', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create a Visualforce Page`);
    // Using the Command palette, run "SFDX: Create Visualforce Page".
    await utilities.createCommand('Visualforce Page', 'VisualforcePage1', 'pages', 'page');

    // Get the matching (visible) items within the tree which contains "AuraInterface1".
    const workbench = await utilities.getWorkbench();
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'VisualforcePage1'
    );
    expect(filteredTreeViewItems.includes('VisualforcePage1.page')).to.equal(true);
    expect(filteredTreeViewItems.includes('VisualforcePage1.page-meta.xml')).to.equal(true);
  });

  step('Verify the contents of the Visualforce Page', async () => {
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
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Sample Analytics Template
  step('Create a Sample Analytics Template', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Create a Sample Analytics Template`);
    // Clear the output panel, then use the Command palette to run, "SFDX: Create Sample Analytics Template".
    const workbench = await utilities.getWorkbench();
    await utilities.clearOutputView();
    const inputBox = await utilities.executeQuickPick(
      'SFDX: Create Sample Analytics Template',
      utilities.Duration.seconds(1)
    );

    // Set the name of the new page to sat1
    await inputBox.setText('sat1');
    await inputBox.confirm();
    await utilities.pause(utilities.Duration.seconds(1));

    // Select the default directory (press Enter/Return).
    await inputBox.confirm();

    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Create Sample Analytics Template successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Finished SFDX: Create Sample Analytics Template',
      10
    );
    expect(outputPanelText).to.not.be.undefined;

    // Check for expected items in the Explorer view.

    // Check for the presence of the corresponding files
    const treeViewItems = await utilities.getVisibleItemsFromSidebar(workbench, projectName);
    expect(treeViewItems.includes('dashboards')).to.equal(true);
    expect(treeViewItems.includes('app-to-template-rules.json')).to.equal(true);
    expect(treeViewItems.includes('folder.json')).to.equal(true);
    expect(treeViewItems.includes('releaseNotes.html')).to.equal(true);
    expect(treeViewItems.includes('template-info.json')).to.equal(true);
    expect(treeViewItems.includes('template-to-app-rules.json')).to.equal(true);
    expect(treeViewItems.includes('ui.json')).to.equal(true);
    expect(treeViewItems.includes('variables.json')).to.equal(true);
  });

  step('Verify the contents of the Sample Analytics Template', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Sample Analytics Template`);
    // Verify the default code for a Sample Analytics Template.
    const workbench = await utilities.getWorkbench();
    let textEditor = await utilities.getTextEditor(workbench, 'app-to-template-rules.json');
    let textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.appToTemplateRules);

    textEditor = await utilities.getTextEditor(workbench, 'folder.json');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.folder);

    textEditor = await utilities.getTextEditor(workbench, 'releaseNotes.html');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.releaseNotes);

    textEditor = await utilities.getTextEditor(workbench, 'template-info.json');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.templateInfo);

    textEditor = await utilities.getTextEditor(workbench, 'template-to-app-rules.json');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.templateToAppRules);

    textEditor = await utilities.getTextEditor(workbench, 'ui.json');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.ui);

    textEditor = await utilities.getTextEditor(workbench, 'variables.json');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.variables);
  });

  // Tear down
  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});
