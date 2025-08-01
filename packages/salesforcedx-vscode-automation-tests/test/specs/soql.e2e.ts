/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Duration,
  log,
  pause,
  TestReqConfig,
  ProjectShapeOption
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  executeQuickPick,
  getTextEditor,
  getWorkbench,
  reloadWindow
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';
import { logTestStart } from '../utils/loggingHelper';

describe('SOQL', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'SOQL',
    extensionConfigs: defaultExtensionConfigs
  };

  before('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);

    // Hide copilot
    await tryToHideCopilot();
  });

  it('SFDX: Create Query in SOQL Builder', async () => {
    logTestStart(testSetup, 'SFDX: Create Query in SOQL Builder');
    // Run SFDX: Create Query in SOQL Builder
    await executeQuickPick('SFDX: Create Query in SOQL Builder', Duration.seconds(3));
    // wait for the soql builder
    await pause(Duration.seconds(20));

    // Verify the command took us to the soql builder
    const workbench = await getWorkbench();
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('untitled.soql');
  });

  it('Switch Between SOQL Builder and Text Editor - from SOQL Builder', async () => {
    logTestStart(testSetup, 'Switch Between SOQL Builder and Text Editor - from SOQL Builder');

    // Click Switch Between SOQL Builder and Text Editor
    const workbench = await getWorkbench();
    const editorView = workbench.getEditorView();
    const toggleSOQLButton = await editorView.getAction('Switch Between SOQL Builder and Text Editor');
    expect(toggleSOQLButton).to.not.be.undefined;
    await toggleSOQLButton?.click();

    // Verify 'Switch Between SOQL Builder and Text Editor' took us to the soql builder
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('untitled.soql');
    const openTabs = await editorView.getOpenEditorTitles();
    expect(openTabs.length).to.equal(3);
    expect(openTabs[1]).to.equal('untitled.soql');
    expect(openTabs[2]).to.equal('untitled.soql');
  });

  it('Switch Between SOQL Builder and Text Editor - from file', async () => {
    logTestStart(testSetup, 'Switch Between SOQL Builder and Text Editor - from file');
    await reloadWindow(Duration.seconds(5));

    // Click Switch Between SOQL Builder and Text Editor
    const workbench = await getWorkbench();
    const editorView = workbench.getEditorView();
    const toggleSOQLButton = await editorView.getAction('Switch Between SOQL Builder and Text Editor');
    expect(toggleSOQLButton).to.not.be.undefined;
  });

  it.skip('Verify the contents of the SOQL Builder', async () => {
    //TODO
  });

  it.skip('Create query in SOQL Builder', async () => {
    //TODO
  });

  it.skip('Verify the contents of the soql file', async () => {
    const expectedText = ['SELECT COUNT()', 'from Account'].join('\n');
    const workbench = await getWorkbench();
    const textEditor = await getTextEditor(workbench, 'countAccounts.soql');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.be(expectedText);
  });

  after('Tear down and clean up the testing environment', async () => {
    log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
