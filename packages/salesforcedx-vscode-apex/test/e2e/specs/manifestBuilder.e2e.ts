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
import { DefaultTreeItem, InputBox, after } from 'vscode-extension-tester';
import { expect } from 'chai';

describe('Manifest Builder', async () => {
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'ManifestBuilder'
  };

  step('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
  });

  step('Generate Manifest File', async () => {
    // Normally we would want to run the 'SFDX: Generate Manifest File' command here, but it is only
    // accessible via a context menu, and wdio-vscode-service isn't able to interact with
    // context menus, so instead the manifest file is manually created:

    utilities.log(`${testSetup.testSuiteSuffixName} - calling createCustomObjects()`);
    await utilities.createCustomObjects(testSetup);

    if (process.platform !== 'darwin') {
      utilities.log(`${testSetup.testSuiteSuffixName} - creating manifest file`);

      const workbench = utilities.getWorkbench();
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }

      const objectTreeItem = (await treeViewSection.findItem('objects')) as DefaultTreeItem;
      if (!objectTreeItem) {
        throw new Error(
          'In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)'
        );
      }

      expect(objectTreeItem).to.not.be.undefined;
      await (await objectTreeItem.wait()).expand();

      const contextMenu = await objectTreeItem.openContextMenu();
      await contextMenu.select('SFDX: Generate Manifest File');
      const inputBox = await InputBox.create();
      await inputBox.setText('manifest');
      await inputBox.confirm();
    }

    if (process.platform === 'darwin') {
      // Using the Command palette, run File: New File...
      const inputBox = await utilities.executeQuickPick('Create: New File...', utilities.Duration.seconds(1));

      // Set the name of the new manifest file
      const filePath = path.join('manifest', 'manifest.xml');
      await inputBox.setText(filePath);

      // The following 3 confirms are just confirming the file creation and the folder it will belong to
      await inputBox.confirm();
      await inputBox.confirm();
      await inputBox.confirm();

      const workbench = utilities.getWorkbench();
      const textEditor = await utilities.getTextEditor(workbench, 'manifest.xml');
      const content = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<Package xmlns="http://soap.sforce.com/2006/04/metadata">`,
        `\t<types>`,
        `\t\t<members>*</members>`,
        `\t\t<name>CustomObject</name>`,
        `\t</types>`,
        `\t<version>57.0</version>`,
        `</Package>`
      ].join('\n');

      await textEditor.setText(content);
      await textEditor.save();
      await utilities.pause(utilities.Duration.seconds(1));
    }
  });

  step('SFDX: Deploy Source in Manifest to Org', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - SFDX: Deploy Source in Manifest to Org`);

    // Clear output before running the command
    await utilities.clearOutputView();

    if (process.platform === 'linux') {
      // Dismiss all notifications using the button in the status bar
      const workbench = utilities.getWorkbench();
      const statusBar = workbench.getStatusBar();
      const notificationsButton = await statusBar.getItem('Notifications');
      if (notificationsButton) {
        await notificationsButton.click();
        const notificationsCenter = await workbench.openNotificationsCenter();
        await notificationsCenter.clearAllNotifications();
      }

      // Using the Context menu, run SFDX: Deploy Source in Manifest to Org
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }

      const manifestTreeItem = (await treeViewSection.findItem('manifest')) as DefaultTreeItem;
      if (!manifestTreeItem) {
        throw new Error(
          'In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)'
        );
      }

      expect(manifestTreeItem).to.not.be.undefined;
      await (await manifestTreeItem.wait()).expand();

      // Locate the "manifest.xml" file within the expanded "manifest" folder
      const manifestXmlFile = (await treeViewSection.findItem('manifest.xml')) as DefaultTreeItem;
      if (!manifestXmlFile) {
        throw new Error(
          'No manifest.xml file found'
        );
      }
      expect(manifestXmlFile).to.not.be.undefined;

      const contextMenu = await manifestXmlFile.openContextMenu();
      await contextMenu.select('SFDX: Deploy Source in Manifest to Org');
    } else {
      // Using the Command palette, run SFDX: Deploy Source in Manifest to Org
      await utilities.executeQuickPick('SFDX: Deploy Source in Manifest to Org', utilities.Duration.seconds(10));
    }

    // Look for the success notification that appears which says, "SFDX: Deploy This Source to Org successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      'SFDX: Deploy This Source to Org successfully ran',
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    const expectedTexts = [
      'Deployed Source',
      `Customer__c  CustomObject  ${path.join(
        'force-app',
        'main',
        'default',
        'objects',
        'Customer__c',
        'Customer__c.object-meta.xml'
      )}`,
      `Product__c   CustomObject  ${path.join(
        'force-app',
        'main',
        'default',
        'objects',
        'Product__c',
        'Product__c.object-meta.xml'
      )}`,
      'ended SFDX: Deploy This Source to Org'
    ];
    // Verify Output tab
    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Deploy This Source to Org',
      10
    );
    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  step('SFDX: Retrieve Source in Manifest from Org', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - SFDX: Retrieve Source in Manifest from Org`);
    const workbench = utilities.getWorkbench();
    await utilities.getTextEditor(workbench, 'manifest.xml');

    // Clear output before running the command
    await utilities.clearOutputView();

    if (process.platform === 'linux') {
      // Dismiss all notifications using the button in the status bar
      const workbench = utilities.getWorkbench();
      const statusBar = workbench.getStatusBar();
      const notificationsButton = await statusBar.getItem('Notifications');
      if (notificationsButton) {
        await notificationsButton.click();
        const notificationsCenter = await workbench.openNotificationsCenter();
        await notificationsCenter.clearAllNotifications();
      }

      // Using the Context menu, run SFDX: Retrieve Source in Manifest from Org
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }

      const manifestTreeItem = (await treeViewSection.findItem('manifest')) as DefaultTreeItem;
      if (!manifestTreeItem) {
        throw new Error(
          'In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)'
        );
      }

      expect(manifestTreeItem).to.not.be.undefined;
      await (await manifestTreeItem.wait()).expand();

      // Locate the "manifest.xml" file within the expanded "manifest" folder
      const manifestXmlFile = (await treeViewSection.findItem('manifest.xml')) as DefaultTreeItem;
      if (!manifestXmlFile) {
        throw new Error(
          'No manifest.xml file found'
        );
      }
      expect(manifestXmlFile).to.not.be.undefined;

      const contextMenu = await manifestXmlFile.openContextMenu();
      await contextMenu.select('SFDX: Retrieve Source in Manifest from Org');
    } else {
      // Using the Command palette, run SFDX: Retrieve Source in Manifest from Org
      await utilities.executeQuickPick('SFDX: Retrieve Source in Manifest from Org', utilities.Duration.seconds(10));
    }

    // Look for the success notification that appears which says, "SFDX: Retrieve This Source from Org successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      'SFDX: Retrieve This Source from Org successfully ran',
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    const expectedTexts = [
      'Retrieved Source',
      `Customer__c  CustomObject  ${path.join(
        'force-app',
        'main',
        'default',
        'objects',
        'Customer__c',
        'Customer__c.object-meta.xml'
      )}`,
      `Product__c   CustomObject  ${path.join(
        'force-app',
        'main',
        'default',
        'objects',
        'Product__c',
        'Product__c.object-meta.xml'
      )}`,
      'ended SFDX: Retrieve This Source from Org'
    ];
    // Verify Output tab
    const outputPanelText = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      'Starting SFDX: Retrieve This Source from Org',
      10
    );
    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
