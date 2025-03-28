/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import path from 'path';
import { TestSetup } from '../testSetup';
import * as utilities from '../utilities/index';
import { WORKSPACE_SETTING_KEYS as WSK } from '../utilities/index';
import { after } from 'vscode-extension-tester';
import { expect } from 'chai';

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
    utilities.log(`Deploy and Retrieve - Set up the testing environment`);
    testSetup = await TestSetup.setUp(testReqConfig);
    projectName = testSetup.tempProjectName;

    // Create Apex Class
    const classText = [
      `public with sharing class MyClass {`,
      ``,
      `\tpublic static void SayHello(string name){`,
      `\t\tSystem.debug('Hello, ' + name + '!');`,
      `\t}`,
      `}`
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

    // Check for expected items in the Explorer view.
    const sidebar = workbench.getSideBar();
    const content = sidebar.getContent();
    const treeViewSection = await content.getSection(projectName);
    await treeViewSection.expand();

    // Get the matching (visible) items within the tree which contain "MyClass".
    const filteredTreeViewItems = await utilities.getFilteredVisibleTreeViewItemLabels(
      workbench,
      projectName,
      'MyClass'
    );

    // It's a tree, but it's also a list.  Everything in the view is actually flat
    // and returned from the call to visibleItems.reduce().
    expect(filteredTreeViewItems.includes('MyClass.cls')).to.equal(true);
    expect(filteredTreeViewItems.includes('MyClass.cls-meta.xml')).to.equal(true);
  });

  step('Verify Source Tracking Setting is enabled', async () => {
    utilities.log(`Deploy and Retrieve - Verify Source Tracking Setting is enabled`);
    expect(await utilities.isBooleanSettingEnabled(WSK.ENABLE_SOURCE_TRACKING_FOR_DEPLOY_AND_RETRIEVE));
  });

  step('Deploy with SFDX: Deploy This Source to Org - ST enabled', async () => {
    utilities.log(`Deploy and Retrieve - Deploy with SFDX: Deploy This Source to Org - ST enabled`);
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    await utilities.getTextEditor(workbench, 'MyClass.cls');
    await utilities.runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClass');
  });

  step('Deploy again (with no changes) - ST enabled', async () => {
    utilities.log(`Deploy and Retrieve - Deploy again (with no changes) - ST enabled`);
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    await utilities.getTextEditor(workbench, 'MyClass.cls');

    await utilities.runAndValidateCommand('Deploy', 'to', 'ST', 'ApexClass', 'MyClass', 'Unchanged  ');
  });

  step('Modify the file and deploy again - ST enabled', async () => {
    utilities.log(`Deploy and Retrieve - Modify the file and deploy again - ST enabled`);
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

  step('Retrieve with SFDX: Retrieve This Source from Org', async () => {
    utilities.log(`Deploy and Retrieve - Retrieve with SFDX: Retrieve This Source from Org`);
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    await utilities.getTextEditor(workbench, 'MyClass.cls');

    await utilities.runAndValidateCommand('Retrieve', 'from', 'ST', 'ApexClass', 'MyClass');
  });

  step('Modify the file and retrieve again', async () => {
    utilities.log(`Deploy and Retrieve - Modify the file and retrieve again`);
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

  step('Prefer Deploy on Save when `Push or deploy on save` is enabled', async () => {
    utilities.log(`Deploy and Retrieve - Prefer Deploy on Save when 'Push or deploy on save' is enabled`);
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
    await textEditor.setTextAtLine(2, `\t// let's trigger deploy`);
    await textEditor.save();
    await utilities.pause(utilities.Duration.seconds(5));

    // At this point there should be no conflicts since this is a new class.
    await utilities.validateCommand('Deploy', 'to', 'on save', 'ApexClass', ['MyClass']);
  });

  step('Disable Source Tracking Setting', async () => {
    utilities.log(`Deploy and Retrieve - Disable Source Tracking Setting`);
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
    utilities.log(`Deploy and Retrieve - Deploy with SFDX: Deploy This Source to Org - ST disabled`);
    const workbench = utilities.getWorkbench();
    // Clear all notifications so clear output button is visible
    await utilities.executeQuickPick('Notifications: Clear All Notifications');
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    await utilities.getTextEditor(workbench, 'MyClass.cls');

    await utilities.runAndValidateCommand('Deploy', 'to', 'no-ST', 'ApexClass', 'MyClass');
  });

  step('Deploy again (with no changes) - ST disabled', async () => {
    utilities.log(`Deploy and Retrieve - Deploy again (with no changes) - ST enabled`);
    const workbench = utilities.getWorkbench();
    // Clear the Output view first.
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    await utilities.getTextEditor(workbench, 'MyClass.cls');

    await utilities.runAndValidateCommand('Deploy', 'to', 'no-ST', 'ApexClass', 'MyClass', 'Unchanged  ');
  });

  step('Modify the file and deploy again - ST disabled', async () => {
    utilities.log(`Deploy and Retrieve - Modify the file and deploy again - ST disabled`);
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

  step('SFDX: Delete This from Project and Org', async () => {
    utilities.log(`Deploy and Retrieve - SFDX: Delete This from Project and Org`);
    const workbench = utilities.getWorkbench();
    await utilities.getTextEditor(workbench, 'MyClass.cls');
    // Run SFDX: Push Source to Default Org and Ignore Conflicts to be in sync with remote
    await utilities.executeQuickPick(
      'SFDX: Push Source to Default Org and Ignore Conflicts',
      utilities.Duration.seconds(10)
    );
    // Clear the Output view first.
    await utilities.clearOutputView();

    // clear notifications
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
      `${path.join(pathToClass)}.cls`,
      `${path.join(pathToClass)}.cls-meta.xml`,
      'ended with exit code 0'
    ];

    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`Deploy and Retrieve - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
