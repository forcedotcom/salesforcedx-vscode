/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Duration,
  log,
  openFile,
  pause,
  ProjectShapeOption,
  TestReqConfig
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { retryOperation } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import { validateCommand } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { createCustomObjects } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  clearOutputView,
  dismissAllNotifications,
  executeQuickPick,
  getTextEditor,
  getWorkbench
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { DefaultTreeItem, InputBox, after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';
import { logTestStart } from '../utils/loggingHelper';

describe('Manifest Builder', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'ManifestBuilder',
    extensionConfigs: defaultExtensionConfigs
  };

  before('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);

    // Hide copilot
    await tryToHideCopilot();
  });

  it('Generate Manifest File', async () => {
    logTestStart(testSetup, 'Generate Manifest File');
    // Normally we would want to run the 'SFDX: Generate Manifest File' command here, but it is only
    // accessible via a context menu, and vscode-extension-tester isn't able to interact with
    // context menus, so instead the manifest file is manually created:

    // update testSetup.testDataFolderPath to be the path to the salesforcedx-vscode-automation-tests package
    testSetup.testDataFolderPath = testSetup.tempFolderPath.replace(
      'e2e-temp',
      'packages/salesforcedx-vscode-automation-tests/test/testData/CustomSObjects'
    );
    log(`testSetup.testDataFolderPath: ${String(testSetup.testDataFolderPath || 'undefined')}`);

    log(`${testSetup.testSuiteSuffixName} - calling createCustomObjects()`);
    await createCustomObjects(testSetup);

    if (process.platform !== 'darwin') {
      log(`${testSetup.testSuiteSuffixName} - creating manifest file`);

      const workbench = getWorkbench();
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }

      const objectTreeItem = await treeViewSection.findItem('objects');
      if (!objectTreeItem) {
        throw new Error('Expected DefaultTreeItem but got undefined');
      }
      if (!(objectTreeItem instanceof DefaultTreeItem)) {
        throw new Error(`Expected DefaultTreeItem but got different item type: ${typeof objectTreeItem}`);
      }
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
      const inputBox = await executeQuickPick('Create: New File...', Duration.seconds(1));

      // Set the name of the new manifest file
      const filePath = path.join('manifest', 'manifest.xml');
      await inputBox.setText(filePath);

      // The following 3 confirms are just confirming the file creation and the folder it will belong to
      await inputBox.confirm();
      await inputBox.confirm();
      await inputBox.confirm();
      await pause(Duration.seconds(1));

      const content = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
        '\t<types>',
        '\t\t<members>*</members>',
        '\t\t<name>CustomObject</name>',
        '\t</types>',
        '\t<version>57.0</version>',
        '</Package>'
      ].join('\n');

      const manifestPath = path.join(testSetup.projectFolderPath!, 'manifest', 'manifest.xml');
      await fs.writeFile(manifestPath, content, 'utf8');
      await pause(Duration.seconds(1));
    }
  });

  it('SFDX: Deploy Source in Manifest to Org', async () => {
    logTestStart(testSetup, 'SFDX: Deploy Source in Manifest to Org');
    log(`Deploy: Current platform is: ${process.platform}`);

    log('Deploy: Getting workbench');
    const workbench = getWorkbench();
    await retryOperation(
      async () => {
        await pause(Duration.seconds(2));
        await dismissAllNotifications();
      },
      3,
      'Deploy: Error dismissing all notifications'
    );

    // Clear output before running the command
    log('Deploy: Clearing output view');

    await pause(Duration.seconds(2));
    await clearOutputView();
    log('Deploy: Opening manifest.xml file');
    await getTextEditor(workbench, 'manifest.xml');
    log('Deploy: manifest.xml file opened');

    log(`Deploy: Checking if platform is Linux (current: ${process.platform})`);
    if (process.platform === 'linux') {
      log('Deploy: Running on Linux platform - using context menu approach');

      // Dismiss all notifications using the button in the status bar
      await dismissAllNotifications();

      // Using the Context menu, run SFDX: Deploy Source in Manifest to Org
      log('Deploy: Getting sidebar and content');
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      log(`Deploy: Looking for tree section: ${testSetup.tempProjectName}`);
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }
      log('Deploy: Found tree view section');

      log('Deploy: Looking for manifest tree item');
      const manifestTreeItem = await treeViewSection.findItem('manifest');
      if (!manifestTreeItem) {
        throw new Error('Expected DefaultTreeItem but got undefined');
      }
      if (!(manifestTreeItem instanceof DefaultTreeItem)) {
        throw new Error(`Expected DefaultTreeItem but got different item type: ${typeof manifestTreeItem}`);
      }
      if (!manifestTreeItem) {
        throw new Error(
          'In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)'
        );
      }
      log('Deploy: Found manifest tree item');

      expect(manifestTreeItem).to.not.be.undefined;
      log('Deploy: Expanding manifest tree item');
      await (await manifestTreeItem.wait()).expand();
      log('Deploy: Manifest tree item expanded, waiting for UI to settle');
      await pause(Duration.seconds(1)); // Wait for expansion to complete

      // Locate the "manifest.xml" file within the expanded "manifest" folder
      log('Deploy: Looking for manifest.xml file in expanded folder');
      const manifestXmlFile = await treeViewSection.findItem('manifest.xml');
      if (!manifestXmlFile) {
        throw new Error('Expected DefaultTreeItem but got undefined');
      }
      if (!(manifestXmlFile instanceof DefaultTreeItem)) {
        throw new Error(`Expected DefaultTreeItem but got different item type: ${typeof manifestXmlFile}`);
      }
      if (!manifestXmlFile) {
        log('Deploy: ERROR - manifest.xml file not found after expansion');
        throw new Error('No manifest.xml file found');
      }
      log('Deploy: Found manifest.xml file');
      expect(manifestXmlFile).to.not.be.undefined;

      // Ensure the file is visible and interactable
      log('Deploy: Selecting manifest.xml file to ensure it is interactable');
      await manifestXmlFile.select();
      log('Deploy: File selected, waiting for UI to update');
      await pause(Duration.milliseconds(500));

      log('Deploy: Opening context menu on manifest.xml');
      const contextMenu = await manifestXmlFile.openContextMenu();
      log('Deploy: Context menu opened, selecting deploy command');
      await contextMenu.select('SFDX: Deploy Source in Manifest to Org');
      log('Deploy: Deploy command selected from context menu');
    } else {
      log(`Deploy: Not running on Linux (platform: ${process.platform}) - using command palette approach`);
      log('Deploy: Opening manifest.xml file to ensure focus');
      await openFile(path.join(`${testSetup.projectFolderPath!}`, 'manifest', 'manifest.xml'));
      log('Deploy: manifest.xml file opened');
      // Using the Command palette, run SFDX: Deploy Source in Manifest to Org
      await executeQuickPick('SFDX: Deploy Source in Manifest to Org', Duration.seconds(10));
      log('Deploy: Command palette deploy command completed');
    }

    log('Deploy: Starting command validation');
    await validateCommand('Deploy', 'to', 'ST', 'CustomObject', ['Customer__c', 'Product__c'], 'Created  ');
    log('Deploy: Command validation completed');
  });

  it('SFDX: Retrieve Source in Manifest from Org', async () => {
    logTestStart(testSetup, 'SFDX: Retrieve Source in Manifest from Org');

    // Clear output before running the command
    await clearOutputView();
    const workbench = getWorkbench();
    await getTextEditor(workbench, 'manifest.xml');

    if (process.platform === 'linux') {
      log('Retrieve: Running on Linux platform - using context menu approach');

      // Dismiss all notifications using the button in the status bar
      await dismissAllNotifications();

      // Using the Context menu, run SFDX: Retrieve Source in Manifest from Org
      log('Retrieve: Getting sidebar and content');
      const sidebar = await workbench.getSideBar().wait();
      const content = await sidebar.getContent().wait();
      log(`Retrieve: Looking for tree section: ${testSetup.tempProjectName}`);
      const treeViewSection = await content.getSection(testSetup.tempProjectName);
      if (!treeViewSection) {
        throw new Error(
          'In verifyProjectLoaded(), getSection() returned a treeViewSection with a value of null (or undefined)'
        );
      }
      log('Retrieve: Found tree view section');

      log('Retrieve: Looking for manifest tree item');
      const manifestTreeItem = await treeViewSection.findItem('manifest');
      if (!manifestTreeItem) {
        throw new Error('Expected DefaultTreeItem but got undefined');
      }
      if (!(manifestTreeItem instanceof DefaultTreeItem)) {
        throw new Error(`Expected DefaultTreeItem but got different item type: ${typeof manifestTreeItem}`);
      }
      if (!manifestTreeItem) {
        throw new Error(
          'In verifyProjectLoaded(), findItem() returned a forceAppTreeItem with a value of null (or undefined)'
        );
      }
      log('Retrieve: Found manifest tree item');

      expect(manifestTreeItem).to.not.be.undefined;
      log('Retrieve: Expanding manifest tree item');
      await (await manifestTreeItem.wait()).expand();
      log('Retrieve: Manifest tree item expanded, waiting for UI to settle');
      await pause(Duration.seconds(1)); // Wait for expansion to complete

      // Locate the "manifest.xml" file within the expanded "manifest" folder
      log('Retrieve: Looking for manifest.xml file in expanded folder');
      const manifestXmlFile = await treeViewSection.findItem('manifest.xml');
      if (!manifestXmlFile) {
        throw new Error('Expected DefaultTreeItem but got undefined');
      }
      if (!(manifestXmlFile instanceof DefaultTreeItem)) {
        throw new Error(`Expected DefaultTreeItem but got different item type: ${typeof manifestXmlFile}`);
      }
      if (!manifestXmlFile) {
        log('Retrieve: ERROR - manifest.xml file not found after expansion');
        throw new Error('No manifest.xml file found');
      }
      log('Retrieve: Found manifest.xml file');
      expect(manifestXmlFile).to.not.be.undefined;

      // Ensure the file is visible and interactable
      log('Retrieve: Selecting manifest.xml file to ensure it is interactable');
      await manifestXmlFile.select();
      log('Retrieve: File selected, waiting for UI to update');
      await pause(Duration.milliseconds(500));

      log('Retrieve: Opening context menu on manifest.xml');
      const contextMenu = await manifestXmlFile.openContextMenu();
      log('Retrieve: Context menu opened, selecting retrieve command');
      await contextMenu.select('SFDX: Retrieve Source in Manifest from Org');
      log('Retrieve: Retrieve command selected from context menu');
    } else {
      // Using the Command palette, run SFDX: Retrieve Source in Manifest from Org
      await executeQuickPick('SFDX: Retrieve Source in Manifest from Org', Duration.seconds(10));
    }

    await validateCommand('Retrieve', 'from', 'ST', 'CustomObject', ['Customer__c', 'Product__c']);
  });

  after('Tear down and clean up the testing environment', async () => {
    log(`${testSetup.testSuiteSuffixName} - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
