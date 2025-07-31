/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Duration,
  findElementByText,
  pause,
  TestReqConfig,
  ProjectShapeOption,
  log
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import {
  createApexClass,
  findTypeInOrgBrowser,
  openOrgBrowser,
  runAndValidateCommand,
  validateCommand,
  verifyOrgBrowserIsOpen
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  closeCurrentEditor,
  dismissAllNotifications,
  getWorkbench
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { By, ModalDialog, after } from 'vscode-extension-tester';
import { logTestStart } from '../utils/loggingHelper';

describe('Org Browser', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'OrgBrowser'
  };

  before('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
  });

  it('Check Org Browser is connected to target org', async () => {
    logTestStart(testSetup, 'Check Org Browser is connected to target org');

    await openOrgBrowser(Duration.seconds(10));
    await verifyOrgBrowserIsOpen();

    log(`${testSetup.testSuiteSuffixName} - Org Browser is connected to target org`);
  });

  it('Check some metadata types are available', async () => {
    logTestStart(testSetup, 'Check some metadata types are available');
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
      const element = await findTypeInOrgBrowser(type);
      expect(element).to.not.be.undefined;
    }
  });

  it('Verify there are no Apex Classes available', async () => {
    logTestStart(testSetup, 'Verify there are no Apex Classes available');
    // Check there are no classes displayed
    const apexClassesLabelEl = await findTypeInOrgBrowser('Apex Classes');
    expect(apexClassesLabelEl).to.not.be.undefined;
    await apexClassesLabelEl?.click();
    await pause(Duration.seconds(10));
    const noCompsAvailableLabelEl = await findElementByText('div', 'aria-label', 'No components available');
    expect(noCompsAvailableLabelEl).to.not.be.undefined;
  });

  it('Create Apex Class and deploy to org', async () => {
    logTestStart(testSetup, 'Create Apex Class and deploy to org');

    // Create Apex Class
    const classText = [
      'public with sharing class MyClass {',
      '',
      '\tpublic static void SayHello(string name){',
      "\t\tSystem.debug('Hello, ' + name + '!');",
      '\t}',
      '}'
    ].join('\n');
    await createApexClass('MyClass', path.join(testSetup.projectFolderPath!, 'force-app', 'main', 'default', 'classes'), classText);
    await runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClass', 'Created  ');

    await closeCurrentEditor();
  });

  it('Refresh Org Browser and check MyClass is there', async () => {
    logTestStart(testSetup, 'Refresh Apex Classes');
    // Check MyClass is present under Apex Classes section
    const apexClassesItem = await findTypeInOrgBrowser('Apex Classes');
    expect(apexClassesItem).to.not.be.undefined;
    const refreshComponentsButton = (await apexClassesItem?.findElements(By.css('a.action-label')))![1];
    expect(refreshComponentsButton).to.not.be.undefined;
    await refreshComponentsButton?.click();
    await pause(Duration.seconds(10));
    const myClassLabelEl = await findTypeInOrgBrowser('MyClass');
    expect(myClassLabelEl).to.not.be.undefined;
  });

  it('Retrieve This Source from Org', async () => {
    logTestStart(testSetup, 'Retrieve This Source from Org');
    const myClassLabelEl = await findTypeInOrgBrowser('MyClass');
    expect(myClassLabelEl).to.not.be.undefined;
    await myClassLabelEl?.click();
    await pause(Duration.seconds(1));
    const retrieveSourceButton = (await myClassLabelEl?.findElements(By.css('a.action-label')))![1];
    expect(retrieveSourceButton).to.not.be.undefined;
    await retrieveSourceButton.click();
    await pause(Duration.seconds(2));
    // Confirm Overwrite
    const modalDialog = new ModalDialog();
    expect(modalDialog).to.not.be.undefined;
    await modalDialog.pushButton('Overwrite');

    await validateCommand('Retrieve', 'from', 'ST', 'ApexClass', ['MyClass']);
  });

  it('Retrieve and Open Source', async () => {
    logTestStart(testSetup, 'Retrieve and Open Source');
    // Close all notifications
    await dismissAllNotifications();
    const myClassLabelEl = await findTypeInOrgBrowser('MyClass');
    expect(myClassLabelEl).to.not.be.undefined;
    await myClassLabelEl?.click();
    await pause(Duration.seconds(1));
    const retrieveAndOpenSourceButton = (await myClassLabelEl?.findElements(By.css('a.action-label')))![0];
    expect(retrieveAndOpenSourceButton).to.not.be.undefined;
    await retrieveAndOpenSourceButton.click();
    await pause(Duration.seconds(2));
    // Confirm Overwrite
    const modalDialog = new ModalDialog();
    expect(modalDialog).to.not.be.undefined;
    await modalDialog.pushButton('Overwrite');

    await validateCommand('Retrieve', 'from', 'ST', 'ApexClass', ['MyClass']);

    // Verify 'Retrieve and Open Source' took us to MyClass.cls
    const workbench = getWorkbench();
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('MyClass.cls');
  });

  after('Tear down and clean up the testing environment', async () => {
    log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
