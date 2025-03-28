/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import { By, InputBox, QuickOpenBox, SideBarView, after } from 'vscode-extension-tester';
import { TestSetup } from '../testSetup';
import * as utilities from '../utilities/index';
import { expect } from 'chai';

describe('Run Apex Tests', async () => {
  let prompt: InputBox | QuickOpenBox;
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'RunApexTests'
  };

  step('Set up the testing environment', async () => {
    utilities.log(`RunApexTests - Set up the testing environment`);
    testSetup = await TestSetup.setUp(testReqConfig);

    // Create Apex class 1 and test
    try {
      await utilities.createApexClassWithTest('ExampleApexClass1');
    } catch (error) {
      await utilities.createApexClassWithTest('ExampleApexClass1');
    }

    // Create Apex class 2 and test
    try {
      await utilities.createApexClassWithTest('ExampleApexClass2');
    } catch (error) {
      await utilities.createApexClassWithTest('ExampleApexClass2');
    }

    // Create Apex class 3 and test
    try {
      await utilities.createApexClassWithTest('ExampleApexClass3');
    } catch (error) {
      await utilities.createApexClassWithTest('ExampleApexClass3');
    }

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
        utilities.Duration.ONE_MINUTE
      );
      expect(successPushNotificationWasFound).to.equal(true);
    }
  });

  step('Verify LSP finished indexing', async () => {
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify LSP finished indexing`);

    // Get Apex LSP Status Bar
    const statusBar = await utilities.getStatusBarItemWhichIncludes('Editor Language Status');
    await statusBar.click();
    expect(await statusBar.getAttribute('aria-label')).to.contain('Indexing complete');
  });

  step('Run All Tests via Apex Class', async () => {
    utilities.log(`RunApexTests - Run All Tests via Apex Class`);
    const workbench = utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'ExampleApexClass1Test.cls');

    // Clear the Output view.
    await utilities.dismissAllNotifications();
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Click the "Run All Tests" code lens at the top of the class
    const runAllTestsOption = await textEditor.getCodeLens('Run All Tests');
    await runAllTestsOption!.click();
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await workbench.openNotificationsCenter();
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'ended SFDX: Run Apex Tests'
    ];

    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  step('Run Single Test via Apex Class', async () => {
    utilities.log(`RunApexTests - Run Single Test via Apex Class`);
    const workbench = utilities.getWorkbench();
    const textEditor = await utilities.getTextEditor(workbench, 'ExampleApexClass2Test.cls');

    // Clear the Output view.
    await utilities.dismissAllNotifications();
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Click the "Run Test" code lens at the top of one of the test methods
    const runTestOption = await textEditor.getCodeLens('Run Test');
    await runTestOption!.click();
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await workbench.openNotificationsCenter();
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass2Test.validateSayHello  Pass',
      'ended SFDX: Run Apex Tests'
    ];

    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  step('Run All Tests via Command Palette', async () => {
    utilities.log(`RunApexTests - Run All Tests via Command Palette`);
    // Clear the Output view.
    await utilities.dismissAllNotifications();
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Run SFDX: Run Apex tests.
    prompt = await utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1));

    // Select the "All Tests" option
    await prompt.selectQuickPick('All Tests');
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await utilities.getWorkbench().openNotificationsCenter();
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            3',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'ExampleApexClass2Test.validateSayHello  Pass',
      'ExampleApexClass3Test.validateSayHello  Pass',
      'ended SFDX: Run Apex Tests'
    ];

    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  step('Run Single Class via Command Palette', async () => {
    utilities.log(`RunApexTests - Run Single Class via Command Palette`);
    // Clear the Output view.
    await utilities.dismissAllNotifications();
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Run SFDX: Run Apex tests.
    prompt = await utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1));

    // Select the "ExampleApexClass1Test" file
    await prompt.selectQuickPick('ExampleApexClass1Test');
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await utilities.getWorkbench().openNotificationsCenter();
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'ended SFDX: Run Apex Tests'
    ];
    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  step('Run All tests via Test Sidebar', async () => {
    utilities.log(`RunApexTests - Run All tests via Test Sidebar`);
    const workbench = utilities.getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');
    expect(testingView).to.not.be.undefined;
    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    expect(testingSideBarView).to.be.instanceOf(SideBarView);

    const apexTestsSection = await utilities.getTestsSection(workbench, 'Apex Tests');
    const expectedItems = ['ExampleApexClass1Test', 'ExampleApexClass2Test', 'ExampleApexClass3Test'];
    const apexTestsItems = await utilities.verifyTestItemsInSideBar(
      apexTestsSection,
      'Refresh Tests',
      expectedItems,
      6,
      3
    );

    // Clear the Output view.
    await utilities.dismissAllNotifications();
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Click the run tests button on the top right corner of the Test sidebar
    await apexTestsSection.click();
    const runTestsAction = await apexTestsSection.getAction('Run Tests');
    await runTestsAction!.click();
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await workbench.openNotificationsCenter();
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            3',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'ExampleApexClass2Test.validateSayHello  Pass',
      'ExampleApexClass3Test.validateSayHello  Pass',
      'ended SFDX: Run Apex Tests'
    ];
    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    for (const item of apexTestsItems) {
      await utilities.verifyTestIconColor(item, 'testPass');
    }
  });

  step('Run All Tests on a Class via the Test Sidebar', async () => {
    utilities.log(`RunApexTests - Run All Tests on a Class via the Test Sidebar`);
    const workbench = utilities.getWorkbench();
    // Clear the Output view.
    await utilities.dismissAllNotifications();
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    const outputPanelText = await utilities.runTestCaseFromSideBar(
      workbench,
      'Apex Tests',
      'ExampleApexClass2Test',
      'Run Tests'
    );
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass2Test.validateSayHello  Pass',
      'ended SFDX: Run Apex Tests'
    ];
    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  step('Run Single Test via the Test Sidebar', async () => {
    utilities.log(`RunApexTests - 'Run Single Test via the Test Sidebar`);
    const workbench = utilities.getWorkbench();
    // Clear the Output view.
    await utilities.dismissAllNotifications();
    await utilities.clearOutputView(utilities.Duration.seconds(2));
    const outputPanelText = await utilities.runTestCaseFromSideBar(
      workbench,
      'Apex Tests',
      'validateSayHello',
      'Run Single Test'
    );
    const expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'ended SFDX: Run Apex Tests'
    ];
    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  step('Run a test that fails and fix it', async () => {
    utilities.log(`RunApexTests - Run a test that fails and fix it`);
    // Create Apex class AccountService
    await utilities.createApexClassWithBugs();

    // Push source to org
    const workbench = utilities.getWorkbench();
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
        utilities.Duration.ONE_MINUTE
      );
      expect(successPushNotificationWasFound).to.equal(true);
    }

    // Clear the Output view.
    await utilities.dismissAllNotifications();
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Run SFDX: Run Apex tests.
    prompt = await utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1));

    // Select the "AccountServiceTest" file
    await prompt.setText('AccountServiceTest');
    await prompt.confirm();
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await workbench.openNotificationsCenter();
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Verify test results are listed on vscode's Output section
    // Also verify that the test fails
    let outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    let expectedTexts = ['Assertion Failed: incorrect ticker symbol', 'Expected: CRM, Actual: SFDC'];

    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);

    // Fix test
    const textEditor = await utilities.getTextEditor(workbench, 'AccountService.cls');
    await textEditor.setTextAtLine(6, '\t\t\tTickerSymbol = tickerSymbol');
    await textEditor.save();
    await utilities.pause(utilities.Duration.seconds(1));

    // Push source to org
    await utilities.executeQuickPick(
      'SFDX: Push Source to Default Org and Ignore Conflicts',
      utilities.Duration.seconds(1)
    );

    // Look for the success notification that appears which says, "SFDX: Push Source to Default Org and Ignore Conflicts successfully ran".
    let successPushNotification2WasFound;
    try {
      successPushNotification2WasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successPushNotification2WasFound).to.equal(true);
    } catch (error) {
      await utilities.getWorkbench().openNotificationsCenter();
      successPushNotification2WasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Push Source to Default Org and Ignore Conflicts successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successPushNotification2WasFound).to.equal(true);
    }

    // Clear the Output view.
    await utilities.dismissAllNotifications();
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Run SFDX: Run Apex tests to verify fix
    prompt = await utilities.executeQuickPick('SFDX: Run Apex Tests', utilities.Duration.seconds(1));

    // Select the "AccountServiceTest" file
    await prompt.setText('AccountServiceTest');
    await prompt.confirm();

    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    const successNotification2WasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Run Apex Tests successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotification2WasFound).to.equal(true);

    // Verify test results are listed on vscode's Output section
    outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expectedTexts = [
      '=== Test Summary',
      'Outcome              Passed',
      'Tests Ran            1',
      'Pass Rate            100%',
      'TEST NAME',
      'AccountServiceTest.should_create_account  Pass',
      'ended SFDX: Run Apex Tests'
    ];

    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  step('Create Apex Test Suite', async () => {
    utilities.log(`RunApexTests - Create Apex Test Suite`);
    // Run SFDX: Create Apex Test Suite.
    prompt = await utilities.executeQuickPick('SFDX: Create Apex Test Suite', utilities.Duration.seconds(2));

    // Set the name of the new Apex Test Suite
    await prompt.setText('ApexTestSuite');
    await prompt.confirm();
    await utilities.pause(utilities.Duration.seconds(2));

    // Choose tests that will belong to the new Apex Test Suite
    await prompt.setText('ExampleApexClass1Test');
    const checkbox = await prompt.findElement(By.css('input.quick-input-list-checkbox'));
    await checkbox.click();
    await utilities.clickFilePathOkButton();

    // Look for the success notification that appears which says, "SFDX: Build Apex Test Suite successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Build Apex Test Suite successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);
  });

  step('Add test to Apex Test Suite', async () => {
    utilities.log(`RunApexTests - Add test to Apex Test Suite`);
    // Run SFDX: Add Tests to Apex Test Suite.
    prompt = await utilities.executeQuickPick('SFDX: Add Tests to Apex Test Suite', utilities.Duration.seconds(1));

    // Select the suite recently created called ApexTestSuite
    await prompt.selectQuickPick('ApexTestSuite');
    await utilities.pause(utilities.Duration.seconds(2));

    // Choose tests that will belong to the already created Apex Test Suite
    await prompt.setText('ExampleApexClass2Test');
    const checkbox = await prompt.findElement(By.css('input.quick-input-list-checkbox'));
    await checkbox.click();
    await utilities.clickFilePathOkButton();

    // Look for the success notification that appears which says, "SFDX: Build Apex Test Suite successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Build Apex Test Suite successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);
  });

  step('Run Apex Test Suite', async () => {
    utilities.log(`RunApexTests - Run Apex Test Suite`);
    // Clear the Output view.
    await utilities.dismissAllNotifications();
    await utilities.clearOutputView(utilities.Duration.seconds(2));

    // Run SFDX: Run Apex Test Suite.
    await utilities.executeQuickPick('SFDX: Run Apex Test Suite', utilities.Duration.seconds(1));

    // Select the suite recently created called ApexTestSuite
    await prompt.selectQuickPick('ApexTestSuite');
    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    let successNotificationWasFound;
    try {
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.TEN_MINUTES
      );
      expect(successNotificationWasFound).to.equal(true);
    } catch (error) {
      await utilities.getWorkbench().openNotificationsCenter();
      successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Run Apex Tests successfully ran/,
        utilities.Duration.ONE_MINUTE
      );
      expect(successNotificationWasFound).to.equal(true);
    }

    // Verify test results are listed on vscode's Output section
    // Also verify that all tests pass
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    const expectedTexts = [
      '=== Test Summary',
      'TEST NAME',
      'ended SFDX: Run Apex Tests',
      'Outcome              Passed',
      'Tests Ran            2',
      'Pass Rate            100%',
      'TEST NAME',
      'ExampleApexClass1Test.validateSayHello  Pass',
      'ExampleApexClass2Test.validateSayHello  Pass',
      'ended SFDX: Run Apex Tests'
    ];
    expect(outputPanelText).to.not.be.undefined;
    await utilities.verifyOutputPanelText(outputPanelText!, expectedTexts);
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`RunApexTests - Tear down and clean up the testing environment`);
    await testSetup?.tearDown();
  });
});
