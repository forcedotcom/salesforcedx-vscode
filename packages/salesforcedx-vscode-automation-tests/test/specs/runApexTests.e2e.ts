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
import {
  getTestsSection,
  runTestCaseFromSideBar,
  verifyTestIconColor,
  verifyTestItemsInSideBar
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  attemptToFindOutputPanelText,
  clearOutputView,
  clickFilePathOkButton,
  dismissAllNotifications,
  executeQuickPick,
  getStatusBarItemWhichIncludes,
  getTextEditor,
  getWorkbench,
  replaceLineInFile,
  verifyOutputPanelText,
  waitForAndGetCodeLens
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { By, InputBox, QuickOpenBox, SideBarView } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { getFolderPath } from '../utils/buildFilePathHelper';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';
import { logTestStart } from '../utils/loggingHelper';

// Helper function to find a checkbox element using multiple selectors.
// Tries different selectors in order until one works.
const findCheckboxElement = async (prompt: InputBox | QuickOpenBox) => {
  const selectors = [
    'div.monaco-custom-toggle.monaco-checkbox', // VSCode 1.103.0
    'div.monaco-custom-toggle.codicon.codicon-check.monaco-checkbox',
    'input.quick-input-list-checkbox'
  ];

  for (const selector of selectors) {
    try {
      const element = await prompt.findElement(By.css(selector));
      if (element) {
        return element;
      }
    } catch {
      continue;
    }
  }

  throw new Error(`Could not find checkbox element with any of the selectors: ${selectors.join(', ')}`);
};

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
    extensionConfigs: defaultExtensionConfigs
  };

  before('Set up the testing environment', async () => {
    log('RunApexTests - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    classesFolderPath = getFolderPath(testSetup.projectFolderPath!, 'classes');

    // Hide copilot
    await tryToHideCopilot();

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

  it('Verify LSP finished indexing', async () => {
    logTestStart(testSetup, 'Verify LSP finished indexing');

    // Get Apex LSP Status Bar
    const statusBar = await retryOperation(async () => await getStatusBarItemWhichIncludes('Editor Language Status'));
    await statusBar.click();
    expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
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
    const outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
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
    const outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
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
    const outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
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
    const outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
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
    const workbench = getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');
    expect(testingView).to.not.be.undefined;
    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    expect(testingSideBarView).to.be.instanceOf(SideBarView);

    const apexTestsSection = await getTestsSection(workbench, 'Apex Tests');
    await pause(Duration.seconds(10)); // Wait for test section to load
    const expectedItems = ['ExampleApexClass1Test', 'ExampleApexClass2Test', 'ExampleApexClass3Test'];
    const apexTestsItems = await verifyTestItemsInSideBar(apexTestsSection, 'Refresh Tests', expectedItems, 6, 3);

    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));

    // Click the run tests button on the top right corner of the Test sidebar
    await apexTestsSection.click();
    const runTestsAction = await apexTestsSection.getAction('Run Tests');
    await runTestsAction!.click();
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
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

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    for (const item of apexTestsItems) {
      await verifyTestIconColor(item, 'testPass');
    }
  });

  it('Run All Tests on a Class via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Run All Tests on a Class via the Test Sidebar');
    const workbench = getWorkbench();
    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));
    const terminalText = await runTestCaseFromSideBar(workbench, 'Apex Tests', 'ExampleApexClass2Test', 'Run Tests');
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass2Test.validateSayHello  Pass',
      'Ended SFDX: Run Apex Tests'
    ];
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);
  });

  it('Run Single Test via the Test Sidebar', async () => {
    logTestStart(testSetup, 'Run Single Test via the Test Sidebar');
    const workbench = getWorkbench();
    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));
    const terminalText = await runTestCaseFromSideBar(workbench, 'Apex Tests', 'validateSayHello', 'Run Single Test');
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'Ended SFDX: Run Apex Tests'
    ];
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    expect(terminalText).to.not.be.undefined;
    await verifyOutputPanelText(terminalText!, expectedTexts);
  });

  // Known issue on Mac GHA: https://gus.lightning.force.com/lightning/r/ADM_Work__c/a07EE00002KT1FhYAL/view
  it('Run a test that fails and fix it', async () => {
    logTestStart(testSetup, 'Run a test that fails and fix it');

    await executeQuickPick('View: Close All Editors', Duration.seconds(1));

    // Create Apex class AccountService
    await createApexClassWithBugs(classesFolderPath);

    // Push source to org
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(1));

    // Look for the success notification that appears which says, "SFDX: Push Source to Default Org successfully ran".
    await verifyNotificationWithRetry(/SFDX: Push Source to Default Org successfully ran/, Duration.TEN_MINUTES);

    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));

    // Run SFDX: Run Apex tests.
    prompt = await executeQuickPick('SFDX: Run Apex Tests', Duration.seconds(1));

    // Select the "AccountServiceTest" file
    await prompt.setText('AccountServiceTest');
    await prompt.confirm();
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify test results are listed on vscode's Output section
    // Also verify that the test fails
    let outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    let expectedTexts = ['Assertion Failed: incorrect ticker symbol', 'Expected: CRM, Actual: SFDC'];

    await verifyOutputPanelText(outputPanelText, expectedTexts);

    // Fix test
    const accountServicePath = `${testSetup.projectFolderPath}/force-app/main/default/classes/AccountService.cls`;
    await replaceLineInFile(accountServicePath, 6, '\t\t\tTickerSymbol = tickerSymbol');
    await pause(Duration.seconds(1));

    // Push source to org
    await executeQuickPick('SFDX: Push Source to Default Org', Duration.seconds(1));

    // Look for the success notification that appears which says, "SFDX: Push Source to Default Org successfully ran".
    await verifyNotificationWithRetry(/SFDX: Push Source to Default Org successfully ran/, Duration.TEN_MINUTES);

    // Clear the Output view.
    await dismissAllNotifications();
    await clearOutputView(Duration.seconds(2));

    // Run SFDX: Run Apex tests to verify fix
    prompt = await executeQuickPick('SFDX: Run Apex Tests', Duration.seconds(1));

    // Select the "AccountServiceTest" file
    await prompt.setText('AccountServiceTest');
    await prompt.confirm();

    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    await verifyNotificationWithRetry(/SFDX: Run Apex Tests successfully ran/, Duration.TEN_MINUTES);

    // Verify test results are listed on vscode's Output section
    outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'AccountServiceTest.should_create_account  Pass',
      'Ended SFDX: Run Apex Tests'
    ];

    await verifyOutputPanelText(outputPanelText, expectedTexts);
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

    // Look for the success notification that appears which says, "SFDX: Build Apex Test Suite successfully ran".
    await verifyNotificationWithRetry(/SFDX: Build Apex Test Suite successfully ran/, Duration.TEN_MINUTES);
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

    // Look for the success notification that appears which says, "SFDX: Build Apex Test Suite successfully ran".
    await verifyNotificationWithRetry(/SFDX: Build Apex Test Suite successfully ran/, Duration.TEN_MINUTES);
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
    const outputPanelText = await attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
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
