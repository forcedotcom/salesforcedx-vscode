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
  TestReqConfig,
  WORKSPACE_SETTING_KEYS as WSK
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { verifyNotificationWithRetry } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import {
  createApexClass,
  runAndValidateCommand,
  validateCommand
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import {
  disableBooleanSetting,
  enableBooleanSetting,
  isBooleanSettingEnabled
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  acceptNotification,
  attemptToFindOutputPanelText,
  clearOutputView,
  dismissAllNotifications,
  executeQuickPick,
  getTextEditor,
  verifyOutputPanelText,
  getWorkbench,
  overrideTextInFile
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { after, DefaultTreeItem } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';
import { logTestStart } from '../utils/loggingHelper';

describe('Deploy and Retrieve', () => {
  const pathToClass = path.join('force-app', 'main', 'default', 'classes', 'MyClass');
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'DeployAndRetrieve',
    extensionConfigs: defaultExtensionConfigs
  };
  before('Set up the testing environment', async () => {
    log('Deploy and Retrieve - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);

    // Hide copilot
    await tryToHideCopilot();

    // Create Apex Class
    const classText = [
      'public with sharing class MyClass {',
      '',
      '\tpublic static void SayHello(string name){',
      "\t\tSystem.debug('Hello, ' + name + '!');",
      '\t}',
      '}'
    ].join('\n');
    await dismissAllNotifications();
    await createApexClass('MyClass', classText);
    const successNotificationWasFound = await verifyNotificationWithRetry(
      /SFDX: Create Apex Class successfully ran/,
      Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    const outputPanelText = await attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Finished SFDX: Create Apex Class',
      10
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain(`${pathToClass}.cls`);
    expect(outputPanelText).to.contain(`${pathToClass}.cls-meta.xml`);
  });

  beforeEach(function () {
    if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
      this.skip();
    }
  });

  it('Verify Source Tracking Setting is enabled', async () => {
    logTestStart(testSetup, 'Verify Source Tracking Setting is enabled');
    expect(await isBooleanSettingEnabled(WSK.ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE));
  });

  it('Deploy with SFDX: Deploy This Source to Org - ST enabled', async () => {
    logTestStart(testSetup, 'Deploy with SFDX: Deploy This Source to Org - ST enabled');
    const workbench = getWorkbench();
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));
    await getTextEditor(workbench, 'MyClass.cls');
    await runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClass');
  });

  it('Deploy again (with no changes) - ST enabled', async () => {
    logTestStart(testSetup, 'Deploy again (with no changes) - ST enabled');
    const workbench = getWorkbench();
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));
    await getTextEditor(workbench, 'MyClass.cls');

    await runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClass', 'Unchanged  ');
  });

  it('Modify the file and deploy again - ST enabled', async () => {
    logTestStart(testSetup, 'Modify the file and deploy again - ST enabled');
    const workbench = getWorkbench();
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));

    // Modify the file by adding a comment.
    const textEditor = await getTextEditor(workbench, 'MyClass.cls');
    const newText = `public with sharing class MyClass {
      // say hello to a given name
      public static void SayHello(string name){
        System.debug('Hello, ' + name + '!');
      }
    }`;
    await overrideTextInFile(textEditor, newText);

    // Deploy running SFDX: Deploy This Source to Org
    await runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClass', 'Changed  ');
  });

  // Use context menu only for Windows and Ubuntu
  if (process.platform !== 'darwin') {
    it('Deploy with context menu from editor view', async () => {
      logTestStart(testSetup, 'Deploy with context menu from editor view');
      const workbench = getWorkbench();
      // Clear the Output view first.
      await clearOutputView(Duration.seconds(2));

      const textEditor = await getTextEditor(workbench, 'MyClass.cls');
      const contextMenu = await textEditor.openContextMenu();
      await contextMenu.select('SFDX: Deploy This Source to Org');

      await validateCommand('Deploy', 'to', 'ST', 'ApexClass', ['MyClass'], 'Unchanged  ');
    });

    it('Deploy with context menu from explorer view', async () => {
      logTestStart(testSetup, 'Deploy with context menu from explorer view');
      // Clear the Output view first.
      await clearOutputView(Duration.seconds(2));
      await executeQuickPick('File: Focus on Files Explorer');
      await pause(Duration.seconds(2));
      const workbench = getWorkbench();
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }
      await treeViewSection.expand();

      // The force-app/main/default and classes folders are already expanded, so we can find the file directly
      const myClassFile = await treeViewSection.findItem('MyClass.cls');
      if (!myClassFile) {
        throw new Error('Expected DefaultTreeItem but got undefined');
      }
      if (!(myClassFile instanceof DefaultTreeItem)) {
        throw new Error(`Expected DefaultTreeItem but got different item type: ${typeof myClassFile}`);
      }
      const contextMenu = await myClassFile.openContextMenu();
      await contextMenu.select('SFDX: Deploy This Source to Org');

      await validateCommand('Deploy', 'to', 'ST', 'ApexClass', ['MyClass'], 'Unchanged  ');
    });
  }

  it('Retrieve with SFDX: Retrieve This Source from Org', async () => {
    logTestStart(testSetup, 'Retrieve with SFDX: Retrieve This Source from Org');
    const workbench = getWorkbench();
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));
    await getTextEditor(workbench, 'MyClass.cls');

    await runAndValidateCommand('Retrieve', 'from', 'ST', 'ApexClass', 'MyClass');
  });

  it('Modify the file and retrieve again', async () => {
    logTestStart(testSetup, 'Modify the file and retrieve again');
    const workbench = getWorkbench();
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));

    // Modify the file by changing the comment.
    const textEditor = await getTextEditor(workbench, 'MyClass.cls');
    const newText = `public with sharing class MyClass {
      // modified comment
      public static void SayHello(string name){
        System.debug('Hello, ' + name + '!');
      }
    }`;
    await overrideTextInFile(textEditor, newText);

    // Retrieve running SFDX: Retrieve This Source from Org

    await runAndValidateCommand('Retrieve', 'from', 'ST', 'ApexClass', 'MyClass');
    // Retrieve operation will overwrite the file, hence the the comment will remain as before the modification
    const textAfterRetrieve = await textEditor.getText();
    expect(textAfterRetrieve).to.not.contain('modified comment');
  });

  // Use context menu only for Windows and Ubuntu
  if (process.platform !== 'darwin') {
    it('Retrieve with context menu from editor view', async () => {
      logTestStart(testSetup, 'Retrieve with context menu from editor view');
      const workbench = getWorkbench();
      // Clear the Output view first.
      await clearOutputView(Duration.seconds(2));

      const textEditor = await getTextEditor(workbench, 'MyClass.cls');
      const contextMenu = await textEditor.openContextMenu();
      await contextMenu.select('SFDX: Retrieve This Source from Org');

      await validateCommand('Retrieve', 'from', 'ST', 'ApexClass', ['MyClass']);
    });
  }

  if (process.platform !== 'darwin') {
    it('Retrieve with context menu from explorer view', async () => {
      logTestStart(testSetup, 'Retrieve with context menu from explorer view');
      // Clear the Output view first.
      await clearOutputView(Duration.seconds(2));
      await executeQuickPick('File: Focus on Files Explorer');
      await pause(Duration.seconds(2));
      const workbench = getWorkbench();
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }

      // The force-app/main/default and classes folders are already expanded, so we can find the file directly
      const myClassFile = await treeViewSection.findItem('MyClass.cls');
      if (!myClassFile) {
        throw new Error('Expected DefaultTreeItem but got undefined');
      }
      if (!(myClassFile instanceof DefaultTreeItem)) {
        throw new Error(`Expected DefaultTreeItem but got different item type: ${typeof myClassFile}`);
      }
      const contextMenu = await myClassFile.openContextMenu();
      await contextMenu.select('SFDX: Retrieve This Source from Org');

      await validateCommand('Retrieve', 'from', 'ST', 'ApexClass', ['MyClass']);
    });
  }

  it('Prefer Deploy on Save when `Push or deploy on save` is enabled', async () => {
    logTestStart(testSetup, "Prefer Deploy on Save when 'Push or deploy on save' is enabled");
    const workbench = getWorkbench();
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));

    expect(await enableBooleanSetting(WSK.PUSH_OR_DEPLOY_ON_SAVE_ENABLED)).to.equal(true);
    await pause(Duration.seconds(3));

    expect(await enableBooleanSetting(WSK.PUSH_OR_DEPLOY_ON_SAVE_PREFER_DEPLOY_ON_SAVE)).to.equal(true);

    // Clear all notifications so clear output button is reachable
    await executeQuickPick('Notifications: Clear All Notifications', Duration.seconds(1));

    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));
    // Modify the file and save to trigger deploy
    const textEditor = await getTextEditor(workbench, 'MyClass.cls');
    // overrideTextInFile writes via fs write, hence file save operation & deploy operation are NOT triggered
    // textEditor.setTextAtLine(2, "\t// let's trigger deploy") can be finicky on local machine
    await textEditor.setTextAtLine(2, "\t// let's trigger deploy");
    await textEditor.save();
    await pause(Duration.seconds(5));

    // At this point there should be no conflicts since this is a new class.
    await validateCommand('Deploy', 'to', 'on save', 'ApexClass', ['MyClass']);
  });

  it('Disable Source Tracking and Deploy On Save Settings', async () => {
    logTestStart(testSetup, 'Disable Source Tracking and Deploy On Save Settings');

    expect(await disableBooleanSetting(WSK.ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE)).to.equal(false);
    await pause(Duration.seconds(3));
    expect(await disableBooleanSetting(WSK.PUSH_OR_DEPLOY_ON_SAVE_ENABLED)).to.equal(false);
    await pause(Duration.seconds(3));
    expect(await disableBooleanSetting(WSK.PUSH_OR_DEPLOY_ON_SAVE_PREFER_DEPLOY_ON_SAVE)).to.equal(false);
  });

  it('Deploy with SFDX: Deploy This Source to Org - ST disabled', async () => {
    logTestStart(testSetup, 'Deploy with SFDX: Deploy This Source to Org - ST disabled');
    const workbench = getWorkbench();
    // Clear all notifications so clear output button is visible
    await executeQuickPick('Notifications: Clear All Notifications');
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));
    await getTextEditor(workbench, 'MyClass.cls');

    await runAndValidateCommand('Deploy', 'to', 'no-ST', 'ApexClass', 'MyClass');
  });

  it('Deploy again (with no changes) - ST disabled', async () => {
    logTestStart(testSetup, 'Deploy again (with no changes) - ST enabled');
    const workbench = getWorkbench();
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));
    await getTextEditor(workbench, 'MyClass.cls');

    await runAndValidateCommand('Deploy', 'to', 'no-ST', 'ApexClass', 'MyClass', 'Unchanged  ');
  });

  it('Modify the file and deploy again - ST disabled', async () => {
    logTestStart(testSetup, 'Modify the file and deploy again - ST disabled');
    const workbench = getWorkbench();
    // Clear the Output view first.
    await clearOutputView(Duration.seconds(2));

    // Modify the file by adding a comment.
    const textEditor = await getTextEditor(workbench, 'MyClass.cls');
    const newText = `public with sharing class MyClass {
      // say hello to a given name - updated
      public static void SayHello(string name){
        System.debug('Hello, ' + name + '!');
      }
    }`;
    await overrideTextInFile(textEditor, newText);

    // Deploy running SFDX: Deploy This Source to Org
    await runAndValidateCommand('Deploy', 'to', 'no-ST', 'ApexClass', 'MyClass', 'Changed  ');
  });

  it('Re-enable Source Tracking', async () => {
    logTestStart(testSetup, 'Re-enable Source Tracking');

    expect(await enableBooleanSetting(WSK.ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE)).to.equal(true);
    await pause(Duration.seconds(3));
  });

  it('SFDX: Delete This from Project and Org - Command Palette', async () => {
    logTestStart(testSetup, 'SFDX: Delete This from Project and Org - Command Palette');
    const workbench = getWorkbench();
    // Close all notifications
    await dismissAllNotifications();

    // Run SFDX: Push Source to Default Org to be in sync with remote
    await executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', Duration.seconds(10));

    // Look for the success notification that appears which says, "SFDX: Push Source to Default Org and Ignore Conflicts successfully ran".
    await verifyNotificationWithRetry(
      /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
      Duration.TEN_MINUTES
    );

    // Clear the Output view first.
    await clearOutputView();

    // Clear notifications
    await dismissAllNotifications();

    await getTextEditor(workbench, 'MyClass.cls');
    await pause(Duration.seconds(1));
    await executeQuickPick('SFDX: Delete This from Project and Org', Duration.seconds(2));

    // Make sure we get a notification for the source delete
    const notificationFound = await verifyNotificationWithRetry(
      /Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org\. Are you sure you want to delete this source from your project and your org\?/,
      Duration.ONE_MINUTE
    );

    expect(notificationFound).to.equal(true);

    // Confirm deletion
    const accepted = await acceptNotification(
      'Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?',
      'Delete Source',
      Duration.seconds(5)
    );
    expect(accepted).to.equal(true);
    const successNotificationWasFound = await verifyNotificationWithRetry(
      /SFDX: Delete from Project and Org successfully ran/,
      Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    // TODO: see how the test can accommodate the new output from CLI.
    // Verify Output tab
    const outputPanelText = await attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Delete from Project and Org',
      10
    );
    log(`Output panel text is: ${outputPanelText}`);

    const expectedTexts = [
      '=== Deleted Source',
      'MyClass',
      'ApexClass',
      `${pathToClass}.cls`,
      `${pathToClass}.cls-meta.xml`,
      'ended with exit code 0'
    ];

    await verifyOutputPanelText(outputPanelText, expectedTexts);
  });

  if (process.platform !== 'darwin') {
    it('Create and push 2 apex classes', async () => {
      logTestStart(testSetup, 'Create and push 2 apex classes');

      // Create the Apex Classes.
      await createCommand('Apex Class', 'ExampleApexClass1', 'classes', 'cls');
      await createCommand('Apex Class', 'ExampleApexClass2', 'classes', 'cls');

      // Close all notifications
      await dismissAllNotifications();

      // Clear the Output view
      await clearOutputView();

      // Push source to org
      await executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', Duration.seconds(1));

      // Look for the success notification that appears which says, "SFDX: Push Source to Default Org and Ignore Conflicts successfully ran".
      await verifyNotificationWithRetry(
        /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
        Duration.TEN_MINUTES
      );
    });

    it('SFDX: Delete This from Project and Org - Right click from editor view', async () => {
      logTestStart(testSetup, 'SFDX: Delete This from Project and Org - Right click from editor view');
      const workbench = getWorkbench();

      // Clear notifications
      await dismissAllNotifications();

      // Clear the Output view
      await clearOutputView();

      const textEditor = await getTextEditor(workbench, 'ExampleApexClass1.cls');
      const contextMenu = await textEditor.openContextMenu();
      await contextMenu.select('SFDX: Delete This from Project and Org');

      // Make sure we get a notification for the source delete
      await verifyNotificationWithRetry(
        /Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org\. Are you sure you want to delete this source from your project and your org\?/,
        Duration.ONE_MINUTE
      );

      // Confirm deletion
      const accepted = await acceptNotification(
        'Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?',
        'Delete Source',
        Duration.seconds(5)
      );
      expect(accepted).to.equal(true);

      const successNotificationWasFound = await verifyNotificationWithRetry(
        /SFDX: Delete from Project and Org successfully ran/,
        Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      // TODO: see how the test can accommodate the new output from CLI.
      // Verify Output tab
      const outputPanelText = await attemptToFindOutputPanelText(
        'Salesforce CLI',
        'Starting SFDX: Delete from Project and Org',
        10
      );
      log(`Output panel text is: ${outputPanelText}`);

      const pathToClassDeleteFromProjectAndOrg = path.join(
        'force-app',
        'main',
        'default',
        'classes',
        'ExampleApexClass1'
      );

      const expectedTexts = [
        '=== Deleted Source',
        'ExampleApexClass1',
        'ApexClass',
        `${pathToClassDeleteFromProjectAndOrg}.cls`,
        `${pathToClassDeleteFromProjectAndOrg}.cls-meta.xml`,
        'ended with exit code 0'
      ];

      await verifyOutputPanelText(outputPanelText, expectedTexts);
    });

    it('SFDX: Delete This from Project and Org - Right click from explorer view', async () => {
      logTestStart(testSetup, 'SFDX: Delete This from Project and Org - Right click from explorer view');
      // Clear the Output view first.
      await clearOutputView();

      // Clear notifications
      await dismissAllNotifications();

      await executeQuickPick('File: Focus on Files Explorer');
      await pause(Duration.seconds(2));
      const workbench = getWorkbench();
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }

      // The force-app/main/default and classes folders are already expanded, so we can find the file directly
      const myClassFile = await treeViewSection.findItem('ExampleApexClass2.cls');
      if (!myClassFile) {
        throw new Error('Expected DefaultTreeItem but got undefined');
      }
      if (!(myClassFile instanceof DefaultTreeItem)) {
        throw new Error(`Expected DefaultTreeItem but got different item type: ${typeof myClassFile}`);
      }
      const contextMenu = await myClassFile.openContextMenu();
      await contextMenu.select('SFDX: Delete from Project and Org');

      // Make sure we get a notification for the source delete
      const notificationFound = await verifyNotificationWithRetry(
        /Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org\. Are you sure you want to delete this source from your project and your org\?/,
        Duration.ONE_MINUTE
      );

      expect(notificationFound).to.equal(true);

      // Confirm deletion
      const accepted = await acceptNotification(
        'Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?',
        'Delete Source',
        Duration.seconds(5)
      );
      expect(accepted).to.equal(true);

      const successNotificationWasFound = await verifyNotificationWithRetry(
        /SFDX: Delete from Project and Org successfully ran/,
        Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      // TODO: see how the test can accommodate the new output from CLI.
      // Verify Output tab
      const outputPanelText = await attemptToFindOutputPanelText(
        'Salesforce CLI',
        'Starting SFDX: Delete from Project and Org',
        10
      );
      log(`Output panel text is: ${outputPanelText}`);

      const pathToClassDeleteFromProjectAndOrg = path.join(
        'force-app',
        'main',
        'default',
        'classes',
        'ExampleApexClass2'
      );

      const expectedTexts = [
        '=== Deleted Source',
        'ExampleApexClass2',
        'ApexClass',
        `${pathToClassDeleteFromProjectAndOrg}.cls`,
        `${pathToClassDeleteFromProjectAndOrg}.cls-meta.xml`,
        'ended with exit code 0'
      ];

      await verifyOutputPanelText(outputPanelText, expectedTexts);
    });
  }

  after('Tear down and clean up the testing environment', async () => {
    log('Deploy and Retrieve - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
