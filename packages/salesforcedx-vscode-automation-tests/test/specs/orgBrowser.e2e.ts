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
import { setSettingValue } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  closeCurrentEditor,
  dismissAllNotifications,
  getWorkbench,
  reloadWindow,
  zoom
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { By, ModalDialog, after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { getFolderPath } from '../utils/buildFilePathHelper';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';
import { logTestStart } from '../utils/loggingHelper';

describe('Org Browser (Legacy)', () => {
  let testSetup: TestSetup;
  let classesFolderPath: string;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'OrgBrowserLegacy',
    extensionConfigs: defaultExtensionConfigs
  };

  before('Set up the testing environment with legacy org browser', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
    classesFolderPath = getFolderPath(testSetup.projectFolderPath!, 'classes');

    // Hide copilot
    await tryToHideCopilot();

    // Set the org browser setting to use legacy implementation
    await setSettingValue('salesforcedx-vscode-core.useNewOrgBrowser', false, true);

    // Reload window to apply the setting
    await reloadWindow(Duration.seconds(10));
  });

  it('Check Legacy Org Browser is connected to target org', async () => {
    logTestStart(testSetup, 'Check Legacy Org Browser is connected to target org');

    await openOrgBrowser(Duration.seconds(10));
    await verifyOrgBrowserIsOpen();

    log(`${testSetup.testSuiteSuffixName} - Legacy Org Browser is connected to target org`);
  });

  it('Check some metadata types are available in legacy org browser', async () => {
    logTestStart(testSetup, 'Check some metadata types are available in legacy org browser');
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

    await zoom('Out', 2, Duration.seconds(1));

    for (const type of metadataTypes) {
      const element = await findTypeInOrgBrowser(type);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      expect(element, `Metadata type ${type} is not available in legacy org browser`).to.not.be.undefined;
    }
  });

  it('Verify there are no Apex Classes available in legacy org browser', async () => {
    logTestStart(testSetup, 'Verify there are no Apex Classes available in legacy org browser');
    // Check there are no classes displayed
    const apexClassesLabelEl = await findTypeInOrgBrowser('Apex Classes');
    expect(apexClassesLabelEl).to.not.be.undefined;
    await apexClassesLabelEl?.click();
    await pause(Duration.seconds(10));
    const noCompsAvailableLabelEl = await findElementByText('div', 'aria-label', 'No components available');
    expect(noCompsAvailableLabelEl).to.not.be.undefined;
  });

  it('Create Apex Class and deploy to org (legacy)', async () => {
    logTestStart(testSetup, 'Create Apex Class and deploy to org (legacy)');

    // Create Apex Class
    const classText = [
      'public with sharing class MyClassLegacy {',
      '',
      '\tpublic static void SayHello(string name){',
      "\t\tSystem.debug('Hello, ' + name + '!');",
      '\t}',
      '}'
    ].join('\n');
    await createApexClass('MyClassLegacy', classesFolderPath, classText);

    // Close all notifications
    await dismissAllNotifications();

    await runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClassLegacy', 'Created  ');

    await closeCurrentEditor();
  });

  it('Refresh Legacy Org Browser and check MyClassLegacy is there', async () => {
    logTestStart(testSetup, 'Refresh Apex Classes (legacy)');
    // Check MyClassLegacy is present under Apex Classes section
    const apexClassesItem = await findTypeInOrgBrowser('Apex Classes');
    expect(apexClassesItem).to.not.be.undefined;
    const refreshComponentsButton = (await apexClassesItem?.findElements(By.css('a.action-label')))![1];
    expect(refreshComponentsButton).to.not.be.undefined;
    await refreshComponentsButton?.click();
    await pause(Duration.seconds(10));
    const myClassLabelEl = await findTypeInOrgBrowser('MyClassLegacy');
    expect(myClassLabelEl).to.not.be.undefined;
  });

  it('Retrieve This Source from Org (legacy)', async () => {
    logTestStart(testSetup, 'Retrieve This Source from Org (legacy)');
    // Close all notifications
    await dismissAllNotifications();
    const myClassLabelEl = await findTypeInOrgBrowser('MyClassLegacy');
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

    await validateCommand('Retrieve', 'from', 'ST', 'ApexClass', ['MyClassLegacy']);
  });

  it('Retrieve and Open Source (legacy)', async () => {
    logTestStart(testSetup, 'Retrieve and Open Source (legacy)');
    // Close all notifications
    await dismissAllNotifications();
    const myClassLabelEl = await findTypeInOrgBrowser('MyClassLegacy');
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

    await validateCommand('Retrieve', 'from', 'ST', 'ApexClass', ['MyClassLegacy']);

    // Verify 'Retrieve and Open Source' took us to MyClassLegacy.cls
    const workbench = getWorkbench();
    const editorView = workbench.getEditorView();
    const activeTab = await editorView.getActiveTab();
    const title = await activeTab?.getTitle();
    expect(title).to.equal('MyClassLegacy.cls');
  });

  after('Tear down and clean up the testing environment', async () => {
    log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
