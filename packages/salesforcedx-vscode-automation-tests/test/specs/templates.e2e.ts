/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  createCommand,
  Duration,
  log,
  pause,
  ProjectShapeOption,
  TestReqConfig
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  getWorkbench,
  getTextEditor,
  getFilteredVisibleTreeViewItemLabels,
  zoom,
  attemptToFindOutputPanelText,
  notificationIsPresentWithTimeout,
  executeQuickPick,
  clearOutputView,
  getVisibleItemsFromSidebar
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { after } from 'vscode-extension-tester';
import * as analyticsTemplate from '../testData/sampleAnalyticsTemplateData';

describe('Templates', () => {
  let testSetup: TestSetup;
  let projectName: string;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'Templates'
  };

  // Set up
  before('Set up the testing environment', async () => {
    log('Templates - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    projectName = testSetup.tempProjectName;
  });

  // Apex Class
  it('Create an Apex Class', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create an Apex Class`);
    // Using the Command palette, run SFDX: Create Apex Class.
    await createCommand('Apex Class', 'ApexClass1', 'classes', 'cls');

    // Check for expected items in the Explorer view.
    const workbench = await getWorkbench();

    // Get the matching (visible) items within the tree which contains "ApexClass1".
    const filteredTreeViewItems = await getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'ApexClass1');

    expect(filteredTreeViewItems.includes('ApexClass1.cls')).to.equal(true);
    expect(filteredTreeViewItems.includes('ApexClass1.cls-meta.xml')).to.equal(true);
  });

  it('Verify the contents of the Apex Class', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Apex Class`);
    const expectedText = ['public with sharing class ApexClass1 {', '    public ApexClass1() {', '', '    }', '}'].join(
      '\n'
    );
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ApexClass1.cls');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Apex Unit Test Class
  it('Create an Apex Unit Test Class', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create an Apex Unit Test Class`);
    // Using the Command palette, run SFDX: Create Apex Unit Test Class.
    await createCommand('Apex Unit Test Class', 'ApexUnitTestClass1', 'classes', 'cls');

    // Check for expected items in the Explorer view.
    const workbench = await getWorkbench();

    // Get the matching (visible) items within the tree which contains "ApexUnitTestClass1".
    const filteredTreeViewItems = await getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'ApexUnitTestClass1'
    );

    expect(filteredTreeViewItems.includes('ApexUnitTestClass1.cls')).to.equal(true);
    expect(filteredTreeViewItems.includes('ApexUnitTestClass1.cls-meta.xml')).to.equal(true);
  });

  it('Verify the contents of the Apex Unit Test Class', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Apex Unit Test Class`);
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
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ApexUnitTestClass1.cls');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.contain(expectedText);
  });

  // Apex Trigger
  it('Create an Apex Trigger', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create an Apex Trigger`);
    // Using the Command palette, run "SFDX: Create Apex Trigger".
    await createCommand('Apex Trigger', 'ApexTrigger1', 'triggers', 'trigger');

    // Check for expected items in the Explorer view.
    const workbench = await getWorkbench();

    // Get the matching (visible) items within the tree which contains "ApexTrigger1".
    const filteredTreeViewItems = await getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'ApexTrigger1');
    expect(filteredTreeViewItems.includes('ApexTrigger1.trigger')).to.equal(true);
    expect(filteredTreeViewItems.includes('ApexTrigger1.trigger-meta.xml')).to.equal(true);
  });

  it('Verify the contents of the Apex Trigger', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Apex Trigger`);
    // Verify the default trigger.
    const expectedText = ['trigger ApexTrigger1 on SOBJECT (before insert) {', '', '}'].join('\n');
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ApexTrigger1.trigger');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Aura App
  it('Create an Aura App', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create an Aura App`);
    // Clear the output panel, then use the Command palette to run, "SFDX: Create Aura App".
    const outputPanelText = await createCommand('Aura App', 'AuraApp1', path.join('aura', 'AuraApp1'), 'app');
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
    const workbench = await getWorkbench();
    const filteredTreeViewItems = await getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'AuraApp1');
    expect(filteredTreeViewItems.includes('AuraApp1.app')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1.app-meta.xml')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1.auradoc')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1.css')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1.svg')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1Controller.js')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1Helper.js')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraApp1Renderer.js')).to.equal(true);
  });

  it('Verify the contents of the Aura App', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura App`);
    // Verify the default code for an Aura App.
    const expectedText = ['<aura:application>', '', '</aura:application>'].join('\n');
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'AuraApp1.app');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Aura Component
  it('Create an Aura Component', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create an Aura Component`);
    // Using the Command palette, run SFDX: Create Aura Component.
    await createCommand('Aura Component', 'auraComponent1', path.join('aura', 'auraComponent1'), 'cmp');
    // Zoom out so all tree items are visible
    const workbench = await getWorkbench();
    await zoom('Out', 1, Duration.seconds(2));
    // Check for the presence of the directory, "auraComponent1".
    const filteredTreeViewItems = await getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'auraComponent1');
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

  it('Verify the contents of the Aura Component', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura Component`);
    const expectedText = ['<aura:component>', '', '</aura:component>'].join('\n');
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'auraComponent1.cmp');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Aura Event
  it('Create an Aura Event', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create an Aura Event`);
    // Using the Command palette, run SFDX: Create Aura Component.
    await createCommand('Aura Event', 'auraEvent1', path.join('aura', 'auraEvent1'), 'evt');

    // Check for expected items in the Explorer view.
    const workbench = await getWorkbench();

    // Check for the presence of the directory, "auraEvent1".
    const filteredTreeViewItems = await getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'auraEvent1');
    expect(filteredTreeViewItems.includes('auraEvent1')).to.equal(true);
    expect(filteredTreeViewItems.includes('auraEvent1.evt')).to.equal(true);
    expect(filteredTreeViewItems.includes('auraEvent1.evt-meta.xml')).to.equal(true);
  });

  it('Verify the contents of the Aura Event', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura Event`);
    const expectedText = ['<aura:event type="APPLICATION" description="Event template" />'].join('\n');
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'auraEvent1.evt');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Aura Interface
  it('Create an Aura Interface', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create an Aura Interface`);
    // Using the Command palette, run "SFDX: Create Aura Interface".
    await createCommand('Aura Interface', 'AuraInterface1', path.join('aura', 'AuraInterface1'), 'intf');

    // Get the matching (visible) items within the tree which contains "AuraInterface1".
    const workbench = await getWorkbench();
    const filteredTreeViewItems = await getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'AuraInterface1');

    expect(filteredTreeViewItems.includes('AuraInterface1.intf')).to.equal(true);
    expect(filteredTreeViewItems.includes('AuraInterface1.intf-meta.xml')).to.equal(true);
  });

  it('Verify the contents of the Aura Interface', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Aura Interface`);
    // Verify the default code for an Aura Interface.
    const expectedText = [
      '<aura:interface description="Interface template">',
      '  <aura:attribute name="example" type="String" default="" description="An example attribute."/>',
      '</aura:interface>'
    ].join('\n');
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'AuraInterface1.intf');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Lightning Web Component
  it('Create Lightning Web Component', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create Lightning Web Component`);
    // Using the Command palette, run SFDX: Create Lightning Web Component.
    await createCommand(
      'Lightning Web Component',
      'lightningWebComponent1',
      path.join('lwc', 'lightningWebComponent1'),
      'js'
    );

    // Check for expected items in the Explorer view.
    const workbench = await getWorkbench();

    // Check for the presence of the directory, "lightningWebComponent1".
    const filteredTreeViewItems = await getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'lightningWebComponent1'
    );
    expect(filteredTreeViewItems.includes('lightningWebComponent1')).to.equal(true);
    expect(filteredTreeViewItems.includes('lightningWebComponent1.html')).to.equal(true);
    expect(filteredTreeViewItems.includes('lightningWebComponent1.js')).to.equal(true);
    expect(filteredTreeViewItems.includes('lightningWebComponent1.js-meta.xml')).to.equal(true);
  });

  it('Verify the contents of the Lightning Web Component', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Lightning Web Component`);
    const expectedText = [
      "import { LightningElement } from 'lwc';",
      '',
      'export default class LightningWebComponent1 extends LightningElement {}'
    ].join('\n');
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'lightningWebComponent1.js');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Visualforce Component
  it('Create a Visualforce Component', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create a Visualforce Component`);
    // Using the Command palette, run "SFDX: Create Visualforce Component".
    await createCommand('Visualforce Component', 'VisualforceCmp1', 'components', 'component');
    // Get the matching (visible) items within the tree which contains "AuraInterface1".
    const workbench = await getWorkbench();
    const filteredTreeViewItems = await getFilteredVisibleTreeViewItemLabels(workbench, projectName, 'VisualforceCmp1');
    expect(filteredTreeViewItems.includes('VisualforceCmp1.component')).to.equal(true);
    expect(filteredTreeViewItems.includes('VisualforceCmp1.component-meta.xml')).to.equal(true);
  });

  it('Verify the contents of the Visualforce Component', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Visualforce Component`);
    // Verify the default code for a Visualforce Component.
    const expectedText = [
      '<apex:component >',
      '<!-- Begin Default Content REMOVE THIS -->',
      '<h1>Congratulations</h1>',
      'This is your new Component',
      '<!-- End Default Content REMOVE THIS -->',
      '</apex:component>'
    ].join('\n');
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'VisualforceCmp1.component');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Visualforce Page
  it('Create a Visualforce Page', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create a Visualforce Page`);
    // Using the Command palette, run "SFDX: Create Visualforce Page".
    await createCommand('Visualforce Page', 'VisualforcePage1', 'pages', 'page');

    // Get the matching (visible) items within the tree which contains "AuraInterface1".
    const workbench = await getWorkbench();
    const filteredTreeViewItems = await getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'VisualforcePage1'
    );
    expect(filteredTreeViewItems.includes('VisualforcePage1.page')).to.equal(true);
    expect(filteredTreeViewItems.includes('VisualforcePage1.page-meta.xml')).to.equal(true);
  });

  it('Verify the contents of the Visualforce Page', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Visualforce Page`);
    // Verify the default code for a Visualforce Page.
    const expectedText = [
      '<apex:page >',
      '<!-- Begin Default Content REMOVE THIS -->',
      '<h1>Congratulations</h1>',
      'This is your new Page',
      '<!-- End Default Content REMOVE THIS -->',
      '</apex:page>'
    ].join('\n');
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'VisualforcePage1.page');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(expectedText);
  });

  // Sample Analytics Template
  it('Create a Sample Analytics Template', async () => {
    log(`${testSetup.testSuiteSuffixName} - Create a Sample Analytics Template`);
    // Clear the output panel, then use the Command palette to run, "SFDX: Create Sample Analytics Template".
    const workbench = await getWorkbench();
    await clearOutputView();
    const inputBox = await executeQuickPick('SFDX: Create Sample Analytics Template', Duration.seconds(1));

    // Set the name of the new page to sat1
    await inputBox.setText('sat1');
    await inputBox.confirm();
    await pause(Duration.seconds(1));

    // Select the default directory (press Enter/Return).
    await inputBox.confirm();

    const successNotificationWasFound = await notificationIsPresentWithTimeout(
      /SFDX: Create Sample Analytics Template successfully ran/,
      Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    const outputPanelText = await attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Finished SFDX: Create Sample Analytics Template',
      10
    );
    expect(outputPanelText).to.not.be.undefined;

    // Check for expected items in the Explorer view.

    // Check for the presence of the corresponding files
    const treeViewItems = await getVisibleItemsFromSidebar(workbench, projectName);
    expect(treeViewItems.includes('dashboards')).to.equal(true);
    expect(treeViewItems.includes('app-to-template-rules.json')).to.equal(true);
    expect(treeViewItems.includes('folder.json')).to.equal(true);
    expect(treeViewItems.includes('releaseNotes.html')).to.equal(true);
    expect(treeViewItems.includes('template-info.json')).to.equal(true);
    expect(treeViewItems.includes('template-to-app-rules.json')).to.equal(true);
    expect(treeViewItems.includes('ui.json')).to.equal(true);
    expect(treeViewItems.includes('variables.json')).to.equal(true);
  });

  it('Verify the contents of the Sample Analytics Template', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify the contents of the Sample Analytics Template`);
    // Verify the default code for a Sample Analytics Template.
    const workbench = await getWorkbench();
    let textEditor = await getTextEditor(workbench, 'app-to-template-rules.json');
    let textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.appToTemplateRules);

    textEditor = await getTextEditor(workbench, 'folder.json');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.folder);

    textEditor = await getTextEditor(workbench, 'releaseNotes.html');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.releaseNotes);

    textEditor = await getTextEditor(workbench, 'template-info.json');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.templateInfo);

    textEditor = await getTextEditor(workbench, 'template-to-app-rules.json');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.templateToAppRules);

    textEditor = await getTextEditor(workbench, 'ui.json');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.ui);

    textEditor = await getTextEditor(workbench, 'variables.json');
    textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.equal(analyticsTemplate.variables);
  });

  // Tear down
  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});
