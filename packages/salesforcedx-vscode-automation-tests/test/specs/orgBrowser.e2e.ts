/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import { TestSetup } from '../testSetup';
import * as utilities from '../utilities/index';
import { expect } from 'chai';
import { By, ModalDialog, after } from 'vscode-extension-tester';

describe('Org Browser', async () => {
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'OrgBrowser'
  };

  step('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
  });

  step('Check Org Browser is connected to target org', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Check Org Browser is connected to target org`);

    await utilities.openOrgBrowser(utilities.Duration.seconds(10));
    await utilities.verifyOrgBrowserIsOpen();

    utilities.log(`${testSetup.testSuiteSuffixName} - Org Browser is connected to target org`);
  });

  step('Check some metadata types are available', async () => {
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
      expect(element).to.not.be.undefined;
    }
  });

  step('Verify there are no Apex Classes available', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify there are no Apex Classes available`);
    // Check there are no classes displayed
    const apexClassesLabelEl = await utilities.findTypeInOrgBrowser('Apex Classes');
    expect(apexClassesLabelEl).to.not.be.undefined;
    await apexClassesLabelEl?.click();
    await utilities.pause(utilities.Duration.seconds(10));
    const noCompsAvailableLabelEl = await utilities.findElementByText('div', 'aria-label', 'No components available');
    expect(noCompsAvailableLabelEl).to.not.be.undefined;
  });

  step('Create Apex Class and deploy to org', async () => {
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
    await utilities.runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClass', 'Created  ');

    await utilities.closeCurrentEditor();
  });

  step('Refresh Org Browser and check MyClass is there', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Refresh Apex Classes`);
    // Check MyClass is present under Apex Classes section
    const apexClassesItem = await utilities.findTypeInOrgBrowser('Apex Classes');
    expect(apexClassesItem).to.not.be.undefined;
    const refreshComponentsButton = (await apexClassesItem?.findElements(By.css('a.action-label')))![1];
    expect(refreshComponentsButton).to.not.be.undefined;
    await refreshComponentsButton?.click();
    await utilities.pause(utilities.Duration.seconds(10));
    const myClassLabelEl = await utilities.findTypeInOrgBrowser('MyClass');
    expect(myClassLabelEl).to.not.be.undefined;
  });

  step('Retrieve This Source from Org', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Retrieve This Source from Org`);
    const myClassLabelEl = await utilities.findTypeInOrgBrowser('MyClass');
    expect(myClassLabelEl).to.not.be.undefined;
    await myClassLabelEl?.click();
    await utilities.pause(utilities.Duration.seconds(1));
    const retrieveSourceButton = (await myClassLabelEl?.findElements(By.css('a.action-label')))![1];
    expect(retrieveSourceButton).to.not.be.undefined;
    await retrieveSourceButton.click();
    await utilities.pause(utilities.Duration.seconds(2));
    // Confirm Overwrite
    const modalDialog = new ModalDialog();
    expect(modalDialog).to.not.be.undefined;
    await modalDialog.pushButton('Overwrite');

    await utilities.validateCommand('Retrieve', 'from', 'ST', 'ApexClass', ['MyClass']);
  });

  step('Retrieve and Open Source', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Retrieve and Open Source`);
    // Close all notifications
    await utilities.dismissAllNotifications();
    const myClassLabelEl = await utilities.findTypeInOrgBrowser('MyClass');
    expect(myClassLabelEl).to.not.be.undefined;
    await myClassLabelEl?.click();
    await utilities.pause(utilities.Duration.seconds(1));
    const retrieveAndOpenSourceButton = (await myClassLabelEl?.findElements(By.css('a.action-label')))![0];
    expect(retrieveAndOpenSourceButton).to.not.be.undefined;
    await retrieveAndOpenSourceButton.click();
    await utilities.pause(utilities.Duration.seconds(2));
    // Confirm Overwrite
    const modalDialog = new ModalDialog();
    expect(modalDialog).to.not.be.undefined;
    await modalDialog.pushButton('Overwrite');

    await utilities.validateCommand('Retrieve', 'from', 'ST', 'ApexClass', ['MyClass']);

    // Verify 'Retrieve and Open Source' took us to MyClass.cls
    const workbench = utilities.getWorkbench();
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('MyClass.cls');
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
