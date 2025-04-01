/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step, xstep } from 'mocha-steps';
import { TestSetup } from 'salesforcedx-vscode-automation-tests-redhat/test/testSetup';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';
import { expect } from 'chai';
import { after } from 'vscode-extension-tester';

describe('SOQL', async () => {
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'SOQL'
  };

  step('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
  });

  step('SFDX: Create Query in SOQL Builder', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - SFDX: Create Query in SOQL Builder`);
    await utilities.pause(utilities.Duration.seconds(20));
    // Run SFDX: Create Query in SOQL Builder
    await utilities.executeQuickPick('SFDX: Create Query in SOQL Builder', utilities.Duration.seconds(3));

    // Verify the command took us to the soql builder
    const workbench = await utilities.getWorkbench();
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('untitled.soql');
  });

  step('Switch Between SOQL Builder and Text Editor - from SOQL Builder', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Switch Between SOQL Builder and Text Editor - from SOQL Builder`);

    // Click Switch Between SOQL Builder and Text Editor
    const workbench = await utilities.getWorkbench();
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

  step('Switch Between SOQL Builder and Text Editor - from file', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Switch Between SOQL Builder and Text Editor - from file`);
    await utilities.reloadWindow(utilities.Duration.seconds(5));

    // Click Switch Between SOQL Builder and Text Editor
    const workbench = await utilities.getWorkbench();
    const editorView = workbench.getEditorView();
    const toggleSOQLButton = await editorView.getAction('Switch Between SOQL Builder and Text Editor');
    expect(toggleSOQLButton).to.not.be.undefined;
  });

  xstep('Verify the contents of the SOQL Builder', async () => {
    //TODO
  });

  xstep('Create query in SOQL Builder', async () => {
    //TODO
  });

  xstep('Verify the contents of the soql file', async () => {
    const expectedText = ['SELECT COUNT()', 'from Account'].join('\n');
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'countAccounts.soql');
    const textGeneratedFromTemplate = (await textEditor.getText()).trimEnd().replace(/\r\n/g, '\n');
    expect(textGeneratedFromTemplate).to.be(expectedText);
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
