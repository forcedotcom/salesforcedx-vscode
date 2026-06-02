/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Duration,
  log,
  pause,
  ProjectShapeOption,
  TestReqConfig
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import {
  retryOperation,
  verifyNotificationWithRetry
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import {
  createApexClassWithBugs,
  createApexClassWithTest
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  attemptToFindOutputPanelText,
  clearOutputView,
  dismissAllNotifications,
  executeQuickPick,
  getTextEditor,
  getWorkbench,
  replaceLineInFile,
  verifyOutputPanelText,
  waitForAndGetCodeLens,
  waitForNotificationToGoAway,
  zoom
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { InputBox, QuickOpenBox } from 'vscode-extension-tester';
import { apexTestExtensionConfigs } from '../testData/constants';
import { expandTestExplorerNamespaceAndPackage, findTestItemByName, getTestResultsTabText } from '../utils/testsHelper';
import { getFolderPath } from '../utils/buildFilePathHelper';
import { logTestStart } from '../utils/loggingHelper';

// Tests for Run Apex Tests. Cases already covered by Playwright specs in
// packages/salesforcedx-vscode-apex-testing/test/playwright/specs have been removed:
// command-palette runs, palette-driven Test Sidebar run-all, and Apex Test Suite create/add/run.
// What remains are cases without Playwright coverage: code-lens runs, Test Sidebar tree-item
// action-button runs (class & method), and the failing-test-then-fix scenario.

describe('Run Apex Tests', () => {
  let prompt: InputBox | QuickOpenBox;
  let testSetup: TestSetup;
  let classesFolderPath: string;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'RunApexTests',
    extensionConfigs: apexTestExtensionConfigs
  };

  before('Set up the testing environment', async () => {
    log('RunApexTests - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    classesFolderPath = getFolderPath(testSetup.projectFolderPath!, 'classes');

    // Create Apex class 1 and test
    await retryOperation(
      () => createApexClassWithTest('ExampleApexClass1', classesFolderPath),
      2,
      'RunApexTests - Error creating Apex class 1 and test'
    );

    // Create Apex class 2 and test
    await retryOperation(
      () => createApexClassWithTest('ExampleApexClass2', classesFolderPath),
      2,
      'RunApexTests - Error creating Apex class 2 and test'
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

  it('Run All Tests via Apex Class', async () => {
    logTestStart(testSetup, 'Run All Tests via Apex Class');
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ExampleApexClass1Test.cls');

    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));

    // Click the "Run All Tests" code lens at the top of the class
    const runAllTestsOption = await waitForAndGetCodeLens(textEditor, 'Run All Tests');
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(runAllTestsOption).to.not.be.undefined;
    await runAllTestsOption!.click();
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await attemptToFindOutputPanelText('Apex Testing', '=== Test Results', 10);
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'Ended SFDX: Run Apex Tests'
    ];

    await verifyOutputPanelText(outputPanelText, expectedTexts);
  });

  it('Run Single Test via Apex Class', async () => {
    logTestStart(testSetup, 'Run Single Test via Apex Class');
    const workbench = getWorkbench();
    const textEditor = await getTextEditor(workbench, 'ExampleApexClass2Test.cls');

    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));

    // Click the "Run Test" code lens at the top of one of the test methods
    const runTestOption = await waitForAndGetCodeLens(textEditor, 'Run Test');
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(runTestOption).to.not.be.undefined;
    await runTestOption!.click();
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await attemptToFindOutputPanelText('Apex Testing', '=== Test Results', 10);
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass2Test.validateSayHello  Pass',
      'Ended SFDX: Run Apex Tests'
    ];

    await verifyOutputPanelText(outputPanelText, expectedTexts);
  });

  it('Run All Tests on a Class via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Run All Tests on a Class via the Test Sidebar');

    // Expand namespace/package so test classes are visible (grouping: Namespace → Package → Class → Method)
    await expandTestExplorerNamespaceAndPackage();

    // Find and click on the test method in the Test Explorer
    const testClassItem = await findTestItemByName('ExampleApexClass2Test');
    await pause(Duration.seconds(5));
    await testClassItem.click();

    // Click Run Test action on the test class
    const runTestsAction = await testClassItem.getActionButton('Run Test');
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(runTestsAction).to.not.be.undefined;
    await runTestsAction!.click();

    // Verify success notification
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify the test report notification appears
    const notificationFound = await verifyNotificationWithRetry(
      /Apex test report is ready: test-result-[a-zA-Z0-9]+\.md/,
      Duration.seconds(30)
    );
    expect(notificationFound).to.equal(true);

    // Verify test results in the Test Results tab
    const testResultsText = await getTestResultsTabText('Apex Testing');
    const expectedTextsInTestResultsTab = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'ExampleApexClass2Test.validateSayHello  Pass'
    ];
    await verifyOutputPanelText(testResultsText, expectedTextsInTestResultsTab);
  });

  it('Run Single Test via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Run Single Test via the Test Sidebar');

    // Expand namespace/package so test classes and methods are visible (grouping: Namespace → Package → Class → Method)
    await expandTestExplorerNamespaceAndPackage();

    // Find and click on the test method in the Test Explorer
    await pause(Duration.seconds(5)); // Wait for the tests to load
    const testMethodItem = await findTestItemByName('validateSayHello');
    await pause(Duration.seconds(5));
    await testMethodItem.click();

    // Click Run Test action on the test method
    const runTestAction = await testMethodItem.getActionButton('Run Test');
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(runTestAction).to.not.be.undefined;
    await runTestAction!.click();

    // Verify success notification
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify the test report notification appears
    const notificationFound = await verifyNotificationWithRetry(
      /Apex test report is ready: test-result-[a-zA-Z0-9]+\.md/,
      Duration.seconds(30)
    );
    expect(notificationFound).to.equal(true);

    // Verify test results in the Test Results tab
    const testResultsText = await getTestResultsTabText('Apex Testing');
    const expectedTextsInTestResultsTab = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'ExampleApexClass2Test.validateSayHello  Pass'
    ];
    await verifyOutputPanelText(testResultsText, expectedTextsInTestResultsTab);
  });

  it('Run a test that fails and fix it', async () => {
    logTestStart(testSetup, 'Run a test that fails and fix it');

    await zoom('Out', 2); // Zoom out the editor view

    // Create Apex class AccountService
    await createApexClassWithBugs(classesFolderPath);

    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(1));
    await waitForNotificationToGoAway(/Deploying 2 components/i, Duration.TEN_MINUTES);

    // Run SFDX: Run Apex tests.
    prompt = await executeQuickPick('SFDX: Run Apex Tests', Duration.seconds(1));

    // Select the "AccountServiceTest" file
    await prompt.setText('AccountServiceTest');
    await prompt.confirm();
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify the test report notification appears
    await verifyNotificationWithRetry(/Apex test report is ready: test-result-[a-zA-Z0-9]+\.md/, Duration.seconds(30));

    // Verify test results in the Test Results tab - verify the test fails
    let testResultsText = await attemptToFindOutputPanelText('Apex Testing', '=== Test Results', 10);
    let expectedTexts = [
      'System.AssertException: Assertion Failed:',
      'incorrect ticker symbol: Expected: CRM, Actual: SFDC'
    ];
    await verifyOutputPanelText(testResultsText, expectedTexts);

    // Fix test
    const accountServicePath = `${testSetup.projectFolderPath}/force-app/main/default/classes/AccountService.cls`;
    await replaceLineInFile(accountServicePath, 6, '\t\t\tTickerSymbol = tickerSymbol');
    await pause(Duration.seconds(1));

    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(1));
    await waitForNotificationToGoAway(/Deploying 1 component/i, Duration.TEN_MINUTES);

    // Run SFDX: Run Apex tests to verify fix
    prompt = await executeQuickPick('SFDX: Run Apex Tests', Duration.seconds(1));

    // Select the "AccountServiceTest" file
    await prompt.setText('AccountServiceTest');
    await prompt.confirm();

    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify the test report notification appears
    await verifyNotificationWithRetry(/Apex test report is ready: test-result-[a-zA-Z0-9]+\.md/, Duration.seconds(30));

    // Verify test results in the Test Results tab - verify the test passes
    testResultsText = await attemptToFindOutputPanelText('Apex Testing', '=== Test Results', 10);
    expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'AccountServiceTest.should_create_account  Pass',
      'Ended SFDX: Run Apex Tests'
    ];
    await verifyOutputPanelText(testResultsText, expectedTexts);
  });

  after('Tear down and clean up the testing environment', async () => {
    log('RunApexTests - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
