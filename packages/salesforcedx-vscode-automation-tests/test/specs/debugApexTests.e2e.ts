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
import {
  retryOperation,
  verifyNotificationWithRetry
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import { createApexClassWithTest } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { continueDebugging, getTestsSection } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  dismissAllNotifications,
  executeQuickPick,
  getTextEditor,
  getWorkbench,
  waitForAndGetCodeLens,
  waitForNotificationToGoAway
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { after } from 'vscode-extension-tester';
import { apexTestExtensionConfigs } from '../testData/constants';
import { expandTestExplorerNamespaceAndPackage, findTestItemByName, verifyTestItems } from '../utils/testsHelper';
import { getFolderPath } from '../utils/buildFilePathHelper';
import { logTestStart } from '../utils/loggingHelper';

describe('Debug Apex Tests', () => {
  let testSetup: TestSetup;
  let classesFolderPath: string;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'DebugApexTests',
    extensionConfigs: apexTestExtensionConfigs
  };

  before('Set up the testing environment', async () => {
    log('DebugApexTests - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    classesFolderPath = getFolderPath(testSetup.projectFolderPath!, 'classes');

    // Create Apex class 1 and test
    await retryOperation(
      () => createApexClassWithTest('ExampleApexClass1', classesFolderPath),
      2,
      'DebugApexTests - Error creating Apex class ExampleApexClass1'
    );

    // Create Apex class 2 and test
    await retryOperation(
      () => createApexClassWithTest('ExampleApexClass2', classesFolderPath),
      2,
      'DebugApexTests - Error creating Apex class ExampleApexClass2'
    );

    await dismissAllNotifications();
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(1));
    await waitForNotificationToGoAway(/Deploying 4 components/i, Duration.TEN_MINUTES);
  });

  beforeEach(function () {
    if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
      this.skip();
    }
  });

  it('Debug All Tests via Apex Class', async () => {
    logTestStart(testSetup, 'Debug All Tests via Apex Class');
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ExampleApexClass1Test.cls');

    // Dismiss all notifications.
    await dismissAllNotifications();

    // Click the "Debug All Tests" code lens at the top of the class
    const debugAllTestsOption = await waitForAndGetCodeLens(textEditor, 'Debug All Tests');
    expect(debugAllTestsOption).to.not.be.undefined;
    log('DebugApexTests - Debug All Tests via Apex Class - clicking debug all tests option');
    await retryOperation(
      async () => {
        await pause(Duration.seconds(2));
        await debugAllTestsOption!.click();
      },
      3,
      'DebugApexTests - Error clicking debug all tests option'
    );

    await pause(Duration.seconds(20));

    // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
    await verifyNotificationWithRetry(/Debug Test\(s\) successfully ran/, Duration.minutes(1));

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  it('Debug Single Test via Apex Class', async () => {
    logTestStart(testSetup, 'Debug Single Test via Apex Class');
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ExampleApexClass2Test.cls');

    // Dismiss all notifications.
    await dismissAllNotifications();

    // Click the "Debug Test" code lens at the top of one of the test methods
    const debugTestOption = await waitForAndGetCodeLens(textEditor, 'Debug Test');
    expect(debugTestOption).to.not.be.undefined;
    await retryOperation(
      async () => {
        await pause(Duration.seconds(2));
        await debugTestOption!.click();
      },
      3,
      'DebugApexTests - Error clicking debug test option'
    );

    // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
    await verifyNotificationWithRetry(/Debug Test\(s\) successfully ran/, Duration.minutes(1));

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  it('Debug all Apex Methods on a Class via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Debug All Apex Methods on a Class via the Test Sidebar');

    await retryOperation(
      async () => {
        await executeQuickPick('Testing: Focus on Test Explorer View');
      },
      3,
      'DebugApexTests - Error focusing on test explorer view'
    );

    await retryOperation(
      async () => executeQuickPick('Test: Refresh Tests', Duration.seconds(1)),
      3,
      'DebugApexTests - Error refreshing test explorer'
    );
    await pause(Duration.seconds(20)); // Wait for the tests to load

    await expandTestExplorerNamespaceAndPackage();

    const expectedItems = ['ExampleApexClass1Test', 'ExampleApexClass2Test'];
    await verifyTestItems(expectedItems);

    // Click the debug tests button that is shown to the right when you hover a test class name on the Test sidebar.
    // Re-fetch the tree row and action button on every attempt, because clicking the row causes VS Code to
    // re-render the tree (selection highlight + action buttons), which invalidates cached WebElement refs
    // and causes StaleElementReferenceError on subsequent interactions.
    await retryOperation(
      async () => {
        await pause(Duration.seconds(2));
        const apexTestItem = await findTestItemByName('ExampleApexClass1Test');
        await apexTestItem.click();
        const debugTestsAction = await apexTestItem.getActionButton('Debug Test');
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        expect(debugTestsAction).to.not.be.undefined;
        await debugTestsAction?.click();
      },
      3,
      'DebugApexTests - Error clicking debug tests action'
    );

    // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
    await verifyNotificationWithRetry(/Debug Test\(s\) successfully ran/, Duration.minutes(1));

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  it('Debug a Single Apex Test Method via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Debug Single Apex Test Method via the Test Sidebar');
    const workbench = getWorkbench();

    await retryOperation(
      async () => {
        await executeQuickPick('Testing: Focus on Test Explorer View');
      },
      3,
      'DebugApexTests - Error focusing on test explorer view'
    );

    // Open the Test Sidebar - now uses VS Code's native Test Explorer
    const testExplorerSection = await retryOperation(
      async () => await getTestsSection(workbench, 'Test Explorer'),
      3,
      'DebugApexTests - Error getting test explorer section'
    );

    await expandTestExplorerNamespaceAndPackage();

    // Hover a test name under one of the test class sections and click the debug button that is shown to the right
    // of the test name on the Test sidebar. Re-fetch the row and action button on each attempt because selecting
    // the row re-renders the tree and can invalidate cached WebElement references (StaleElementReferenceError).
    await retryOperation(
      async () => {
        await pause(Duration.seconds(2));
        await testExplorerSection.click();
        const apexTestItem = await findTestItemByName('validateSayHello');
        await apexTestItem.click();
        const debugTestAction = await apexTestItem.getActionButton('Debug Test');
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        expect(debugTestAction).to.not.be.undefined;
        await debugTestAction?.click();
      },
      3,
      'DebugApexTests - Error clicking debug test action'
    );

    // Look for the success notification that appears which says, "Debug Test(s) successfully ran".
    await verifyNotificationWithRetry(/Debug Test\(s\) successfully ran/, Duration.minutes(1));

    // Continue with the debug session
    await continueDebugging(2, 30);
  });

  after('Tear down and clean up the testing environment', async () => {
    log('DebugApexTests - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
