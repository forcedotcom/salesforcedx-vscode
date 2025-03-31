/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import path from 'path';
import { TestSetup } from 'salesforcedx-vscode-automation-tests-redhat/test/testSetup';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';
import { expect } from 'chai';
import { By, after } from 'vscode-extension-tester';

describe('Visualforce LSP', async () => {
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'VisualforceLsp'
  };

  step('Set up the testing environment', async () => {
    utilities.log('VisualforceLsp - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);

    // Create Apex controller for the Visualforce Page
    await utilities.createApexController();

    // Clear output before running the command
    await utilities.clearOutputView();
    utilities.log(`${testSetup.testSuiteSuffixName} - calling createVisualforcePage()`);
    await utilities.createVisualforcePage();

    const pathToPagesFolder = path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'pages');
    const pathToPage = path.join('force-app', 'main', 'default', 'pages', 'FooPage.page');

    // Create an array of strings for the expected output text
    const expectedTexts = [
      `target dir = ${pathToPagesFolder}`,
      `create ${pathToPage}`,
      `create ${pathToPage}-meta.xml`,
      'Finished SFDX: Create Visualforce Page'
    ];
    // Check output panel to validate file was created...
    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Create Visualforce Page',
      10
    );
    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);

    // Get open text editor and verify file content
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'FooPage.page');
    const fileContent = await textEditor.getText();
    expect(fileContent).to.contain('<apex:page controller="myController" tabStyle="Account">');
    expect(fileContent).to.contain('</apex:page>');
  });

  xstep('Go to Definition', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Go to Definition`);
    // Get open text editor
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'FooPage.page');
    await textEditor.moveCursor(1, 25);

    // Go to definition through F12
    await utilities.executeQuickPick('Go to Definition', utilities.Duration.seconds(2));
    await utilities.pause(utilities.Duration.seconds(1));

    // TODO: go to definition is actually not working

    // // Verify 'Go to definition' took us to the definition file
    // const activeTab = await editorView.getActiveTab();
    // const title = await activeTab?.getTitle();
    // expect(title).toBe('MyController.cls');
  });

  step('Autocompletion', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Autocompletion`);
    // Get open text editor
    const workbench = await utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'FooPage.page');
    await textEditor.typeTextAt(3, 1, '\t\t<apex:pageM');
    await utilities.pause(utilities.Duration.seconds(1));

    // Verify autocompletion options are present
    const autocompletionOptions = await workbench.findElements(By.css('div.monaco-list-row.show-file-icons'));
    const ariaLabel = await autocompletionOptions[0].getAttribute('aria-label');
    expect(ariaLabel).to.contain('apex:pageMessage');

    // Verify autocompletion options can be selected and therefore automatically inserted into the file
    await autocompletionOptions[0].click();
    await textEditor.typeText('/>');
    await textEditor.save();
    await utilities.pause(utilities.Duration.seconds(1));
    const line3Text = await textEditor.getTextAtLine(3);
    expect(line3Text).to.contain('apex:pageMessage');
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
