/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { step } from 'mocha-steps';
import path from 'path';
import { TestSetup } from 'salesforcedx-vscode-automation-tests-redhat/test/testSetup';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';
import { WORKSPACE_SETTING_KEYS as WSK } from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';
import { after, DefaultTreeItem } from 'vscode-extension-tester';

describe('Deploy and Retrieve', async () => {
  let projectName: string;
  const pathToClass = path.join('force-app', 'main', 'default', 'classes', 'MyClass');
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'DeployAndRetrieve'
  };
  step('Set up the testing environment', async () => {
    utilities.log('Deploy and Retrieve - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    projectName = testSetup.tempProjectName;

    // Create Apex Class
    const classText = [
      'public with sharing class MyClass {',
      '',
      '\tpublic static void SayHello(string name){',
      "\t\tSystem.debug('Hello, ' + name + '!');",
      '\t}',
      '}'
    ].join('\n');
    await utilities.dismissAllNotifications();
    await utilities.createApexClass('MyClass', classText);
    const workbench = utilities.getWorkbench();
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Create Apex Class successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Finished SFDX: Create Apex Class',
      10
    );
    expect(outputPanelText).to.not.be.undefined;
    expect(outputPanelText).to.contain(`${pathToClass}.cls`);
    expect(outputPanelText).to.contain(`${pathToClass}.cls-meta.xml`);
  });

  step('Verify Source Tracking Setting is enabled', async () => {
    utilities.log('Deploy and Retrieve - Verify Source Tracking Setting is enabled');
    expect(await utilities.isBooleanSettingEnabled(WSK.ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE));
  });

  step('Deploy with SFDX: Deploy This Source to Org - ST enabled', async () => {
    utilities.log('Deploy and Retrieve - Deploy with SFDX: Deploy This Source to Org - ST enabled');
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    await utilities.getTextEditor(workbench, 'MyClass.cls');
    await utilities.runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClass');
  });

  step('Deploy again (with no changes) - ST enabled', async () => {
    utilities.log('Deploy and Retrieve - Deploy again (with no changes) - ST enabled');
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    await utilities.getTextEditor(workbench, 'MyClass.cls');

    await utilities.runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClass', 'Unchanged  ');
  });

  step('Modify the file and deploy again - ST enabled', async () => {
    utilities.log('Deploy and Retrieve - Modify the file and deploy again - ST enabled');
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Modify the file by adding a comment.
    const textEditor = await utilities.getTextEditor(workbench, 'MyClass.cls');
    await textEditor.setTextAtLine(2, '\t//say hello to a given name');
    await textEditor.save();

    // Deploy running SFDX: Deploy This Source to Org
    await utilities.runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClass', 'Changed  ');
  });

  // Use context menu only for Windows and Ubuntu
  if (process.platform !== 'darwin') {
    step('Deploy with context menu from editor view', async () => {
      utilities.log(`Deploy with context menu from editor view`);
      const workbench = utilities.getWorkbench();
      // Clear the Output view first.
      await utilities.clearOutputView(utilities.Duration.seconds(2));

      const textEditor = await utilities.getTextEditor(workbench, 'MyClass.cls');
      const contextMenu = await textEditor.openContextMenu();
      await contextMenu.select('SFDX: Deploy This Source to Org');

      await utilities.validateCommand('Deploy', 'to', 'ST', 'ApexClass', ['MyClass'], 'Unchanged  ');
    });
  }

  if (process.platform !== 'darwin') {
    step('Deploy with context menu from explorer view', async () => {
      utilities.log(`Deploy with context menu from explorer view`);
      // Clear the Output view first.
      await utilities.clearOutputView(utilities.Duration.seconds(2));
      await utilities.executeQuickPick('File: Focus on Files Explorer');
      await utilities.pause(utilities.Duration.seconds(2));
      const workbench = utilities.getWorkbench();
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
      const myClassFile = (await treeViewSection.findItem('MyClass.cls')) as DefaultTreeItem;
      const contextMenu = await myClassFile.openContextMenu();
      await contextMenu.select('SFDX: Deploy This Source to Org');

      await utilities.validateCommand('Deploy', 'to', 'ST', 'ApexClass', ['MyClass'], 'Unchanged  ');
    });
  }

  step('Retrieve with SFDX: Retrieve This Source from Org', async () => {
    utilities.log('Deploy and Retrieve - Retrieve with SFDX: Retrieve This Source from Org');
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    await utilities.getTextEditor(workbench, 'MyClass.cls');

    await utilities.runAndValidateCommand('Retrieve', 'from', 'ST', 'ApexClass', 'MyClass');
  });

  step('Modify the file and retrieve again', async () => {
    utilities.log('Deploy and Retrieve - Modify the file and retrieve again');
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Modify the file by changing the comment.
    const textEditor = await utilities.getTextEditor(workbench, 'MyClass.cls');
    await textEditor.setTextAtLine(2, '\t//modified comment');
    await textEditor.save();

    // Retrieve running SFDX: Retrieve This Source from Org

    await utilities.runAndValidateCommand('Retrieve', 'from', 'ST', 'ApexClass', 'MyClass');
    // Retrieve operation will overwrite the file, hence the the comment will remain as before the modification
    const textAfterRetrieve = await textEditor.getText();
    expect(textAfterRetrieve).to.not.contain('modified comment');
  });

  // Use context menu only for Windows and Ubuntu
  if (process.platform !== 'darwin') {
    step('Retrieve with context menu from editor view', async () => {
      utilities.log(`Retrieve with context menu from editor view`);
      const workbench = utilities.getWorkbench();
      // Clear the Output view first.
      await utilities.clearOutputView(utilities.Duration.seconds(2));

      const textEditor = await utilities.getTextEditor(workbench, 'MyClass.cls');
      const contextMenu = await textEditor.openContextMenu();
      await contextMenu.select('SFDX: Retrieve This Source from Org');

      await utilities.validateCommand('Retrieve', 'from', 'ST', 'ApexClass', ['MyClass']);
    });
  }

  if (process.platform !== 'darwin') {
    step('Retrieve with context menu from explorer view', async () => {
      utilities.log(`Retrieve with context menu from explorer view`);
      // Clear the Output view first.
      await utilities.clearOutputView(utilities.Duration.seconds(2));
      await utilities.executeQuickPick('File: Focus on Files Explorer');
      await utilities.pause(utilities.Duration.seconds(2));
      const workbench = utilities.getWorkbench();
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }

      // The force-app/main/default and classes folders are already expanded, so we can find the file directly
      const myClassFile = (await treeViewSection.findItem('MyClass.cls')) as DefaultTreeItem;
      const contextMenu = await myClassFile.openContextMenu();
      await contextMenu.select('SFDX: Retrieve This Source from Org');

      await utilities.validateCommand('Retrieve', 'from', 'ST', 'ApexClass', ['MyClass']);
    });
  }

  step('Prefer Deploy on Save when `Push or deploy on save` is enabled', async () => {
    utilities.log("Deploy and Retrieve - Prefer Deploy on Save when 'Push or deploy on save' is enabled");
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    expect(await utilities.enableBooleanSetting(WSK.PUSH_OR_DEPLOY_ON_SAVE_ENABLED)).to.equal(true);
    await utilities.pause(utilities.Duration.seconds(3));

    expect(await utilities.enableBooleanSetting(WSK.PUSH_OR_DEPLOY_ON_SAVE_PREFER_DEPLOY_ON_SAVE)).to.equal(true);

    // Clear all notifications so clear output button is reachable
    await utilities.executeQuickPick('Notifications: Clear All Notifications', utilities.Duration.seconds(1));

    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    // Modify the file and save to trigger deploy
    const textEditor = await utilities.getTextEditor(workbench, 'MyClass.cls');
    await textEditor.setTextAtLine(2, "\t// let's trigger deploy");
    await textEditor.save();
    await utilities.pause(utilities.Duration.seconds(5));

    // At this point there should be no conflicts since this is a new class.
    await utilities.validateCommand('Deploy', 'to', 'on save', 'ApexClass', ['MyClass']);
  });

  step('Disable Source Tracking Setting', async () => {
    utilities.log('Deploy and Retrieve - Disable Source Tracking Setting');
    await utilities.executeQuickPick('Notifications: Clear All Notifications', utilities.Duration.seconds(1));

    expect(await utilities.disableBooleanSetting(WSK.ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE)).to.equal(false);

    // Reload window to update cache and get the setting behavior to work
    await utilities.reloadWindow();
    await utilities.verifyExtensionsAreRunning(
      utilities.getExtensionsToVerifyActive(),
      utilities.Duration.seconds(100)
    );
  });

  step('Deploy with SFDX: Deploy This Source to Org - ST disabled', async () => {
    utilities.log('Deploy and Retrieve - Deploy with SFDX: Deploy This Source to Org - ST disabled');
    const workbench = utilities.getWorkbench();
    // Clear all notifications so clear output button is visible
    await utilities.executeQuickPick('Notifications: Clear All Notifications');
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    await utilities.getTextEditor(workbench, 'MyClass.cls');

    await utilities.runAndValidateCommand('Deploy', 'to', 'no-ST', 'ApexClass', 'MyClass');
  });

  step('Deploy again (with no changes) - ST disabled', async () => {
    utilities.log('Deploy and Retrieve - Deploy again (with no changes) - ST enabled');
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    await utilities.getTextEditor(workbench, 'MyClass.cls');

    await utilities.runAndValidateCommand('Deploy', 'to', 'no-ST', 'ApexClass', 'MyClass', 'Unchanged  ');
  });

  step('Modify the file and deploy again - ST disabled', async () => {
    utilities.log('Deploy and Retrieve - Modify the file and deploy again - ST disabled');
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Modify the file by adding a comment.
    const textEditor = await utilities.getTextEditor(workbench, 'MyClass.cls');
    await textEditor.setTextAtLine(2, '\t//say hello to a given name');
    await textEditor.save();

    // Deploy running SFDX: Deploy This Source to Org
    await utilities.runAndValidateCommand('Deploy', 'to', 'no-ST', 'ApexClass', 'MyClass', 'Changed  ');
  });

  step('SFDX: Delete This from Project and Org - Command Palette', async () => {
    utilities.log(`Deploy and Retrieve - SFDX: Delete This from Project and Org - Command Palette`);
    const workbench = utilities.getWorkbench();

    // Run SFDX: Push Source to Default Org and Ignore Conflicts to be in sync with remote
    await utilities.executeQuickPick(
      'SFDX: Push Source to Default Org and Ignore Conflicts',
      utilities.Duration.seconds(10)
    );

    // Clear the Output view first.
    await utilities.clearOutputView();

    // Clear notifications
    await utilities.dismissAllNotifications();

    await utilities.getTextEditor(workbench, 'MyClass.cls');
    await utilities.pause(utilities.Duration.seconds(1));
    await utilities.executeQuickPick('SFDX: Delete This from Project and Org', utilities.Duration.seconds(2));

    // Make sure we get a notification for the source delete
    const notificationFound = await utilities.notificationIsPresentWithTimeout(
      /Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org\. Are you sure you want to delete this source from your project and your org\?/,
      utilities.Duration.ONE_MINUTE
    );

    expect(notificationFound).to.equal(true);

    // Confirm deletion
    const accepted = await utilities.acceptNotification(
      'Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?',
      'Delete Source',
      utilities.Duration.seconds(5)
    );
    expect(accepted).to.equal(true);
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Delete from Project and Org successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    // TODO: see how the test can accommodate the new output from CLI.
    // Verify Output tab
    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Delete from Project and Org',
      10
    );
    utilities.log('Output panel text is: ' + outputPanelText);

    const expectedTexts = [
      '=== Deleted Source',
      'MyClass',
      'ApexClass',
      `${pathToClass}.cls`,
      `${pathToClass}.cls-meta.xml`,
      'ended with exit code 0'
    ];

    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  if (process.platform !== 'darwin') {
    step('Create and push 2 apex classes', async () => {
      utilities.log('Deploy and Retrieve - Create and push 2 apex classes');

      // Create the Apex Classes.
      await utilities.createCommand('Apex Class', 'ExampleApexClass1', 'classes', 'cls');
      await utilities.createCommand('Apex Class', 'ExampleApexClass2', 'classes', 'cls');

      // Reload the VSCode window to allow the LWC to be indexed by the Apex Language Server
      await utilities.reloadWindow(utilities.Duration.seconds(20));

      // Push source to org
      await utilities.executeQuickPick(
        'SFDX: Push Source to Default Org and Ignore Conflicts',
        utilities.Duration.seconds(1)
      );

      // Look for the success notification that appears which says, "SFDX: Push Source to Default Org and Ignore Conflicts successfully ran".
      let successPushNotificationWasFound;
      try {
        successPushNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
          /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
          utilities.Duration.TEN_MINUTES
        );
        expect(successPushNotificationWasFound).to.equal(true);
      } catch (error) {
        await utilities.getWorkbench().openNotificationsCenter();
        successPushNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
          /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
          utilities.Duration.TEN_MINUTES
        );
        expect(successPushNotificationWasFound).to.equal(true);
      }
    });

    step('SFDX: Delete This from Project and Org - Right click from editor view', async () => {
      utilities.log('Deploy and Retrieve - SFDX: Delete This from Project and Org - Right click from editor view');
      const workbench = utilities.getWorkbench();
      // Clear the Output view first.
      await utilities.clearOutputView();

      // Clear notifications
      await utilities.dismissAllNotifications();

      const textEditor = await utilities.getTextEditor(workbench, 'ExampleApexClass1.cls');
      const contextMenu = await textEditor.openContextMenu();
      await contextMenu.select('SFDX: Delete This from Project and Org');

      // Make sure we get a notification for the source delete
      const notificationFound = await utilities.notificationIsPresentWithTimeout(
        /Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org\. Are you sure you want to delete this source from your project and your org\?/,
        utilities.Duration.ONE_MINUTE
      );

      expect(notificationFound).to.equal(true);

      // Confirm deletion
      const accepted = await utilities.acceptNotification(
        'Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?',
        'Delete Source',
        utilities.Duration.seconds(5)
      );
      expect(accepted).to.equal(true);

      const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Delete from Project and Org successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      // TODO: see how the test can accommodate the new output from CLI.
      // Verify Output tab
      const outputPanelText = await utilities.attemptToFindOutputPanelText(
        'Salesforce CLI',
        'Starting SFDX: Delete from Project and Org',
        10
      );
      utilities.log('Output panel text is: ' + outputPanelText);

      const pathToClass = path.join('force-app', 'main', 'default', 'classes', 'ExampleApexClass1');

      const expectedTexts = [
        '=== Deleted Source',
        'ExampleApexClass1',
        'ApexClass',
        `${pathToClass}.cls`,
        `${pathToClass}.cls-meta.xml`,
        'ended with exit code 0'
      ];

      expect(outputPanelText).to.not.be.undefined;
      await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
    });

    step('SFDX: Delete This from Project and Org - Right click from explorer view', async () => {
      utilities.log('SFDX: Delete This from Project and Org - Right click from explorer view');
      // Clear the Output view first.
      await utilities.clearOutputView();

      // Clear notifications
      await utilities.dismissAllNotifications();

      await utilities.executeQuickPick('File: Focus on Files Explorer');
      await utilities.pause(utilities.Duration.seconds(2));
      const workbench = utilities.getWorkbench();
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }

      // The force-app/main/default and classes folders are already expanded, so we can find the file directly
      const myClassFile = (await treeViewSection.findItem('ExampleApexClass2.cls')) as DefaultTreeItem;
      const contextMenu = await myClassFile.openContextMenu();
      await contextMenu.select('SFDX: Delete from Project and Org');

      // Make sure we get a notification for the source delete
      const notificationFound = await utilities.notificationIsPresentWithTimeout(
        /Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org\. Are you sure you want to delete this source from your project and your org\?/,
        utilities.Duration.ONE_MINUTE
      );

      expect(notificationFound).to.equal(true);

      // Confirm deletion
      const accepted = await utilities.acceptNotification(
        'Deleting source files deletes the files from your computer and removes the corresponding metadata from your default org. Are you sure you want to delete this source from your project and your org?',
        'Delete Source',
        utilities.Duration.seconds(5)
      );
      expect(accepted).to.equal(true);

      const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Delete from Project and Org successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);

      // TODO: see how the test can accommodate the new output from CLI.
      // Verify Output tab
      const outputPanelText = await utilities.attemptToFindOutputPanelText(
        'Salesforce CLI',
        'Starting SFDX: Delete from Project and Org',
        10
      );
      utilities.log('Output panel text is: ' + outputPanelText);

      const pathToClass = path.join('force-app', 'main', 'default', 'classes', 'ExampleApexClass2');

      const expectedTexts = [
        '=== Deleted Source',
        'ExampleApexClass2',
        'ApexClass',
        `${pathToClass}.cls`,
        `${pathToClass}.cls-meta.xml`,
        'ended with exit code 0'
      ];

      expect(outputPanelText).to.not.be.undefined;
      await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
    });
  }

  after('Tear down and clean up the testing environment', async () => {
    utilities.log('Deploy and Retrieve - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
