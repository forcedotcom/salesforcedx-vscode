/*
 * Copyright (c) 2023, salesforce.com, inc.
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
  acceptNotification,
  attemptToFindOutputPanelText,
  clearOutputView,
  clickFilePathOkButton,
  dismissAllNotifications,
  executeQuickPick,
  getTextEditor,
  getWorkbench,
  replaceLineInFile,
  verifyOutputPanelText,
  waitForAndGetCodeLens,
  zoom
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { By, InputBox, QuickOpenBox,  } from 'vscode-extension-tester';
import { apexTestExtensionConfigs } from '../testData/constants';
import {
  findCheckboxElement,
  findTestItemByName,
  getTestResultsTabText,
  verifyTestItems,
  verifyTestItemsIconColor
} from '../utils/apexTestsHelper';
import { getFolderPath } from '../utils/buildFilePathHelper';
import { logTestStart } from '../utils/loggingHelper';

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

    // Create Apex class 3 and test
    await retryOperation(
      () => createApexClassWithTest('ExampleApexClass3', classesFolderPath),
      2,
      'RunApexTests - Error creating Apex class 3 and test'
    );

    // Dismiss all notifications so the push one can be seen
    await dismissAllNotifications();

    // Push source to org
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(1));

    // Look for the success notification that appears which says, "SFDX: Push Source to Default Org successfully ran".
    await verifyNotificationWithRetry(/SFDX: Push Source to Default Org successfully ran/, Duration.TEN_MINUTES);
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

  it('Run All Tests via Command Palette', async () => {
    logTestStart(testSetup, 'Run All Tests via Command Palette');
    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));

    // Run SFDX: Run Apex tests.
    prompt = await executeQuickPick('SFDX: Run Apex Tests', Duration.seconds(1));

    // Select the "All Tests" option
    await prompt.selectQuickPick('All Tests');
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    await pause(Duration.seconds(10)); // Remove this once we have a way to wait for the tests to finish running

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await attemptToFindOutputPanelText('Apex Testing', '=== Test Results', 10);
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            3',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'ExampleApexClass2Test.validateSayHello  Pass',
      'ExampleApexClass3Test.validateSayHello  Pass',
      'Ended SFDX: Run Apex Tests'
    ];

    await verifyOutputPanelText(outputPanelText, expectedTexts);
  });

  it('Run Single Class via Command Palette', async () => {
    logTestStart(testSetup, 'Run Single Class via Command Palette');
    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));

    // Run SFDX: Run Apex tests.
    prompt = await executeQuickPick('SFDX: Run Apex Tests', Duration.seconds(1));

    // Select the "ExampleApexClass1Test" file
    await prompt.selectQuickPick('ExampleApexClass1Test');
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

  it('Run All tests via Test Sidebar', async () => {
    logTestStart(testSetup, 'Run All tests via Test Sidebar');

    // Open the Test Sidebar - now uses VS Code's native Test Explorer
    await retryOperation(
      async () => {
        await executeQuickPick('Testing: Focus on Test Explorer View');
      },
      3,
      'RunApexTests - Error focusing on test explorer view'
    );

    await retryOperation(
      async () => executeQuickPick('Test: Refresh Tests', Duration.seconds(1)),
      3,
      'RunApexTests - Error refreshing test explorer'
    );
    await pause(Duration.seconds(20)); // Wait for the tests to load

    // Verify the expected test items appear
    const expectedTestNames = ['ExampleApexClass1Test', 'ExampleApexClass2Test', 'ExampleApexClass3Test'];
    const testItems = await verifyTestItems(expectedTestNames);

    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));

    // Click the run tests button on the top right corner of the Test sidebar
    await retryOperation(
      async () => await executeQuickPick('Test: Run All Tests', Duration.seconds(1)),
      3,
      'RunApexTests - Error running all tests'
    );

    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify the test report notification appears with dynamic runId
    const notificationFound = await verifyNotificationWithRetry(
      /Apex test report is ready: test-result-[a-zA-Z0-9]+\.md/,
      Duration.seconds(30)
    );
    expect(notificationFound).to.equal(true);

    // Click "Open Report" button on the notification (use partial match for the notification text)
    const accepted = await acceptNotification('Apex test report is ready:', 'Open Report', Duration.seconds(5));
    expect(accepted).to.equal(true);
    await pause(Duration.seconds(3));

    // Verify the markdown preview tab opens (tab label contains "Preview test-result-*.md")
    const previewTab = await getWorkbench().findElement(By.css('div.tab-label[aria-label*="Preview test-result-"]'));
    const tabLabel = await previewTab.getAttribute('aria-label');
    expect(tabLabel).to.match(/Preview test-result-[a-zA-Z0-9]+\.md/);

    // Verify test results in the Test Results tab (xterm terminal)
    const testResultsText = await getTestResultsTabText();
    const expectedTextsInTestResultsTab = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            3',
      'Pass Rate            100%',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'ExampleApexClass2Test.validateSayHello  Pass',
      'ExampleApexClass3Test.validateSayHello  Pass'
    ];
    await verifyOutputPanelText(testResultsText, expectedTextsInTestResultsTab);

    // Verify the tests that are passing are showing the right icon in Test Explorer
    await verifyTestItemsIconColor(testItems, 'testPass');
  });

  it('Run All Tests on a Class via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Run All Tests on a Class via the Test Sidebar');

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
    const testResultsText = await getTestResultsTabText();
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
    const testResultsText = await getTestResultsTabText();
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

    // Push source to org
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(1));

    // Look for the success notification that appears which says, "SFDX: Push Source to Default Org successfully ran".
    await verifyNotificationWithRetry(/SFDX: Push Source to Default Org successfully ran/, Duration.TEN_MINUTES);

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
    let testResultsText = await getTestResultsTabText();
    let expectedTexts = ['Assertion Failed: incorrect ticker symbol', 'Expected: CRM, Actual: SFDC'];
    await verifyOutputPanelText(testResultsText, expectedTexts);

    // Fix test
    const accountServicePath = `${testSetup.projectFolderPath}/force-app/main/default/classes/AccountService.cls`;
    await replaceLineInFile(accountServicePath, 6, '\t\t\tTickerSymbol = tickerSymbol');
    await pause(Duration.seconds(1));

    // Push source to org
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(1));

    // Look for the success notification that appears which says, "SFDX: Push Source to Default Org successfully ran".
    await verifyNotificationWithRetry(/SFDX: Push Source to Default Org successfully ran/, Duration.TEN_MINUTES);

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

  it('Create Apex Test Suite', async () => {
    logTestStart(testSetup, 'Create Apex Test Suite');
    // Run SFDX: Create Apex Test Suite.
    prompt = await executeQuickPick('SFDX: Create Apex Test Suite', Duration.seconds(2));

    // Set the name of the new Apex Test Suite
    await prompt.setText('ApexTestSuite');
    await prompt.confirm();
    await pause(Duration.seconds(2));

    // Choose tests that will belong to the new Apex Test Suite
    await prompt.setText('ExampleApexClass1Test');
    const checkbox = await findCheckboxElement(prompt);
    await checkbox.click();
    await clickFilePathOkButton();

    // Look for the success notification that appears which says, "SFDX: Create Apex Test Suite successfully ran".
    await verifyNotificationWithRetry(/SFDX: Create Apex Test Suite successfully ran/, Duration.TEN_MINUTES);
  });

  it('Add test to Apex Test Suite', async () => {
    logTestStart(testSetup, 'Add test to Apex Test Suite');
    // Run SFDX: Add Tests to Apex Test Suite.
    prompt = await executeQuickPick('SFDX: Add Tests to Apex Test Suite', Duration.seconds(1));

    // Select the suite recently created called ApexTestSuite
    await prompt.selectQuickPick('ApexTestSuite');
    await pause(Duration.seconds(2));

    // Choose tests that will belong to the already created Apex Test Suite
    await prompt.setText('ExampleApexClass2Test');

    await retryOperation(
      async () => {
        const checkbox = await findCheckboxElement(prompt);
        await checkbox.click();
      },
      2,
      'RunApexTests - Error clicking checkbox'
    );
    await clickFilePathOkButton();

    // Look for the success notification that appears which says, "SFDX: Add Tests to Apex Test Suite successfully ran".
    await verifyNotificationWithRetry(/SFDX: Add Tests to Apex Test Suite successfully ran/, Duration.TEN_MINUTES);
  });

  it('Run Apex Test Suite', async () => {
    logTestStart(testSetup, 'Run Apex Test Suite');
    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));

    // Run SFDX: Run Apex Test Suite.
    await executeQuickPick('SFDX: Run Apex Test Suite', Duration.seconds(1));

    // Select the suite recently created called ApexTestSuite
    await prompt.selectQuickPick('ApexTestSuite');
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await attemptToFindOutputPanelText('Apex Testing', '=== Test Results', 10);
    const expectedTexts = [
      '=== Test Summary',
      'TEST NAME',
      'Outcome              Passed',
      'Tests Ran            2',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'ExampleApexClass2Test.validateSayHello  Pass',
      'Ended SFDX: Run Apex Tests'
    ];
    await verifyOutputPanelText(outputPanelText, expectedTexts);
  });

  after('Tear down and clean up the testing environment', async () => {
    log('RunApexTests - Tear down and clean up the testing environment');
    await testSetup?.tearDown();
  });
});
