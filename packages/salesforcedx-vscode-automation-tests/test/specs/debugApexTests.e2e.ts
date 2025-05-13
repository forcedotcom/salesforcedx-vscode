/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  TestReqConfig,
  ProjectShapeOption,
  pause,
  Duration
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { log } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core/miscellaneous';
import { createApexClassWithTest } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import {
  continueDebugging,
  getTestsSection,
  verifyTestItemsInSideBar
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  executeQuickPick,
  notificationIsPresentWithTimeout,
  getWorkbench,
  getStatusBarItemWhichIncludes,
  getTextEditor,
  dismissAllNotifications
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { step } from 'mocha-steps';
import { TreeItem, after } from 'vscode-extension-tester';

describe('Debug Apex Tests', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'DebugApexTests'
  };

  before('Set up the testing environment', async () => {
    log('DebugApexTests - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);

    // Create Apex class 1 and test
    try {
      await createApexClassWithTest('ExampleApexClass1');
    } catch (error) {
      await createApexClassWithTest('ExampleApexClass1');
    }

    // Create Apex class 2 and test
    try {
      await createApexClassWithTest('ExampleApexClass2');
    } catch (error) {
      await createApexClassWithTest('ExampleApexClass2');
    }

    // Push source to org
    await executeQuickPick('SFDX: Push Source to Default Org and Ignore Conflicts', Duration.seconds(1));

    // Look for the success notification that appears which says, "SFDX: Push Source to Default Org and Ignore Conflicts successfully ran".
    let successPushNotificationWasFound;
    try {
      successPushNotificationWasFound = await notificationIsPresentWithTimeout(
        /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
        Duration.TEN_MINUTES
      );
      expect(successPushNotificationWasFound).to.equal(true);
    } catch (error) {
      await getWorkbench().openNotificationsCenter();
      successPushNotificationWasFound = await notificationIsPresentWithTimeout(
        /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
        Duration.TEN_MINUTES
      );
      expect(successPushNotificationWasFound).to.equal(true);
    }
  });

  step('Verify LSP finished indexing', async () => {
    log(`${testSetup.testSuiteSuffixName} - Verify LSP finished indexing`);

    // Get Apex LSP Status Bar
    const statusBar = await getStatusBarItemWhichIncludes('Editor Language Status');
    await statusBar.click();
    expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
  });

  step('Debug All Tests via Apex Class', async () => {
    log('DebugApexTests - Debug All Tests via Apex Class');
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ExampleApexClass1Test.cls');

    // Dismiss all notifications.
    await dismissAllNotifications();

    // Click the "Debug All Tests" code lens at the top of the class
    const debugAllTestsOption = await textEditor.getCodeLens('Debug All Tests');
    await debugAllTestsOption!.click();
    await pause(Duration.seconds(20));

    // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await notificationIsPresentWithTimeout(
        /Debug Test\(s\) successfully ran/,
        Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await workbench.openNotificationsCenter();
      successNotificationWasFound = await notificationIsPresentWithTimeout(
        /Debug Test\(s\) successfully ran/,
        Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  step('Debug Single Test via Apex Class', async () => {
    log('DebugApexTests - Debug Single Test via Apex Class');
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ExampleApexClass2Test.cls');

    // Dismiss all notifications.
    await dismissAllNotifications();

    // Click the "Debug Test" code lens at the top of one of the test methods
    const debugTestOption = await textEditor.getCodeLens('Debug Test');
    await debugTestOption!.click();
    await pause(Duration.seconds(20));

    // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await notificationIsPresentWithTimeout(
        /Debug Test\(s\) successfully ran/,
        Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await workbench.openNotificationsCenter();
      successNotificationWasFound = await notificationIsPresentWithTimeout(
        /Debug Test\(s\) successfully ran/,
        Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  step('Debug all Apex Methods on a Class via the Test Sidebar', async () => {
    log('DebugApexTests - Debug All Apex Methods on a Class via the Test Sidebar');
    const workbench = getWorkbench();
    await executeQuickPick('Testing: Focus on Apex Tests View', Duration.seconds(1));

    // Open the Test Sidebar
    const apexTestsSection = await getTestsSection(workbench, 'Apex Tests');
    const expectedItems = ['ExampleApexClass1Test', 'ExampleApexClass2Test'];

    await verifyTestItemsInSideBar(apexTestsSection, 'Refresh Tests', expectedItems, 4, 2);

    // Click the debug tests button that is shown to the right when you hover a test class name on the Test sidebar
    await apexTestsSection.click();
    const apexTestItem = (await apexTestsSection.findItem('ExampleApexClass1Test')) as TreeItem;
    await apexTestItem.select();
    const debugTestsAction = await apexTestItem.getActionButton('Debug Tests');
    expect(debugTestsAction).to.not.be.undefined;
    await debugTestsAction?.click();
    await pause(Duration.seconds(20));

    // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await notificationIsPresentWithTimeout(
        /Debug Test\(s\) successfully ran/,
        Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await workbench.openNotificationsCenter();
      successNotificationWasFound = await notificationIsPresentWithTimeout(
        /Debug Test\(s\) successfully ran/,
        Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  step('Debug a Single Apex Test Method via the Test Sidebar', async () => {
    log("DebugApexTests - 'Debug Single Apex Test Method via the Test Sidebar");
    const workbench = getWorkbench();
    await executeQuickPick('Testing: Focus on Apex Tests View', Duration.seconds(1));

    // Open the Test Sidebar
    const apexTestsSection = await getTestsSection(workbench, 'Apex Tests');

    // Hover a test name under one of the test class sections and click the debug button that is shown to the right of the test name on the Test sidebar
    await apexTestsSection.click();
    const apexTestItem = (await apexTestsSection.findItem('validateSayHello')) as TreeItem;
    await apexTestItem.select();
    const debugTestAction = await apexTestItem.getActionButton('Debug Single Test');
    expect(debugTestAction).to.not.be.undefined;
    await debugTestAction?.click();
    await pause(Duration.seconds(20));

    // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await notificationIsPresentWithTimeout(
        /Debug Test\(s\) successfully ran/,
        Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await workbench.openNotificationsCenter();
      successNotificationWasFound = await notificationIsPresentWithTimeout(
        /Debug Test\(s\) successfully ran/,
        Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  after('Tear down and clean up the testing environment', async () => {
    log('DebugApexTests - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
