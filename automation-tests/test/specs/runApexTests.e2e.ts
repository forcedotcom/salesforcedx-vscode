/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import {
  CodeLens,
  InputBox,
  QuickOpenBox,
  SideBarView,
  TextEditor,
  TreeItem
} from 'wdio-vscode-service';
import {
  ScratchOrg
} from '../scratchOrg';
import * as utilities from '../utilities';

describe('Run Apex Tests', async () => {
  let prompt: QuickOpenBox | InputBox;
  let scratchOrg: ScratchOrg;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('RunApexTests', true); // TODO: Change back to false
    await scratchOrg.setUp();

    const workbench = await browser.getWorkbench();

    // Create Apex class 1 and test
    await utilities.createApexClassWithTest('ExampleApexClass1');

    // Create Apex class 2 and test
    await utilities.createApexClassWithTest('ExampleApexClass2');

    // Create Apex class 3 and test
    await utilities.createApexClassWithTest('ExampleApexClass3');

    // Push source to scratch org
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 6);
  });

  // step('Run All Tests via Apex Class', async () => {
  //   const workbench = await browser.getWorkbench();
  //   const editorView = workbench.getEditorView();
  //   let textEditor: TextEditor;

  //   // Open an existing apex test (e.g. BotTest.cls, search for @isTest)
  //   textEditor = await editorView.openEditor('ExampleApexClass1Test.cls') as TextEditor;

  //   // Click the "Run All Tests" code lens at the top of the class
  //   const codeLenses = await textEditor.getCodeLenses() as CodeLens[];
  //   const opt1 = await codeLenses[0].getText();
  //   const opt2 = await codeLenses[1].getText();
  //   const codeLens = await textEditor.getCodeLens('Run All Tests') as CodeLens;
  //   await (await codeLens.elem).click();

  //   // Wait for the command to execute
  //   await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
  //   await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
  //   await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

  //   // Look for the success notification that appears which says, "SFDX: Build Apex Test Suite successfully ran".
  //   const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests successfully ran');
  //   if (successNotificationWasFound !== true) {
  //     const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests failed to run');
  //     if (failureNotificationWasFound === true) {
  //       expect(successNotificationWasFound).toBe(false);
  //     }
  //   } else {
  //     expect(successNotificationWasFound).toBe(true);
  //   }

  //   // Verify test results are listed on vscode's Output section
  //   const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
  //   expect(outputPanelText).not.toBeUndefined();
  //   expect(outputPanelText).toContain('=== Test Summary');
  //   expect(outputPanelText).toContain('TEST NAME');
  //   expect(outputPanelText).toContain('ExampleApexClass1Test.validateSayHello');
  //   expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');
  // });

  // step('Run Single Test via Apex Class', async () => {
  //   const workbench = await browser.getWorkbench();
  //   const editorView = workbench.getEditorView();
  //   let textEditor: TextEditor;

  //   // Open an existing apex test (e.g. BotTest.cls, search for @isTest)
  //   textEditor = await editorView.openEditor('ExampleApexClass2Test.cls') as TextEditor;

  //   // Click the "Run Test" code lens at the top of one of the test methods
  //   const codeLens = await textEditor.getCodeLens('Run Test') as CodeLens;
  //   await (await codeLens.elem).click();

  //   // Wait for the command to execute
  //   await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
  //   await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
  //   await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

  //   // Look for the success notification that appears which says, "SFDX: Build Apex Test Suite successfully ran".
  //   const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests successfully ran');
  //   if (successNotificationWasFound !== true) {
  //     const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests failed to run');
  //     if (failureNotificationWasFound === true) {
  //       expect(successNotificationWasFound).toBe(false);
  //     }
  //   } else {
  //     expect(successNotificationWasFound).toBe(true);
  //   }

  //   // Verify test results are listed on vscode's Output section
  //   const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
  //   expect(outputPanelText).not.toBeUndefined();
  //   expect(outputPanelText).toContain('=== Test Summary');
  //   expect(outputPanelText).toContain('TEST NAME');
  //   expect(outputPanelText).toContain('ExampleApexClass2Test.validateSayHello');
  //   expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');
  // });

  step('Run Tests via Command Palette', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Run Apex tests.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Run Apex Tests', 1);

    // Select the "ExampleApexClass1Test" file
    prompt.selectQuickPick('ExampleApexClass1Test');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);
    }

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('=== Test Summary');
    expect(outputPanelText).toContain('TEST NAME');
    expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');
  });

  step('Re-run Last Apex Test Class', async () => {
    const workbench = await browser.getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');
    let textEditor: TextEditor;
    const editorView = workbench.getEditorView();

    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    expect(testingSideBarView).toBeInstanceOf(SideBarView);

    const sidebar = workbench.getSideBar();
    const sidebarView = sidebar.getContent();
    const apexTestsSection = await sidebarView.getSection('APEX TESTS');
    expect(apexTestsSection.elem).toBePresent();

    // Open an existing apex test and modify it
    textEditor = await editorView.openEditor('ExampleApexClass1Test.cls') as TextEditor;
    await textEditor.setText('@isTest\npublic class ExampleApexClass1Test {\n\t@isTest\n\tstatic void validateSayHello() {\n\t\tSystem.debug(\'Starting validate\');\n\t\tExampleApexClass1.SayHello(\'Andres\');\n\t\tSystem.assertEquals(1, 1, \'all good\');\n\t}\n}');
    await textEditor.save();

    // Open command palette and run "SFDX: Push Source to Default Scratch Org"
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 3);

    // Once push is successful, open command palette and run "SFDX: Re-Run Last Run Apex Test Class"
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts successfully ran');
    if (successNotificationWasFound) {
      await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Re-Run Last Run Apex Test Class', 1);
    } else {
      expect(successNotificationWasFound).toBe(false);
    }
  });

  step('Run all Apex tests via Test Sidebar', async () => {
    const workbench = await browser.getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');

    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    expect(testingSideBarView).toBeInstanceOf(SideBarView);

    const sidebar = workbench.getSideBar();
    const sidebarView = sidebar.getContent();
    const apexTestsSection = await sidebarView.getSection('APEX TESTS');
    expect(apexTestsSection.elem).toBePresent();

    const apexTestsItems = await apexTestsSection.getVisibleItems() as TreeItem[];
    expect(apexTestsItems.length).toBe(6);
    expect(await apexTestsSection.findItem('ExampleApexClass1Test')).toBeTruthy();
    expect(await apexTestsSection.findItem('ExampleApexClass2Test')).toBeTruthy();
    expect(await apexTestsSection.findItem('ExampleApexClass3Test')).toBeTruthy();
    expect(await apexTestsItems[0].getLabel()).toBe('ExampleApexClass1Test');
    expect(await apexTestsItems[2].getLabel()).toBe('ExampleApexClass2Test');
    expect(await apexTestsItems[4].getLabel()).toBe('ExampleApexClass3Test');

    // Click the run tests button on the top right corner of the Test sidebar
    const runTestsAction = await apexTestsSection.getAction('Run Tests');
    await runTestsAction!.elem.click();

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);
    }

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('=== Test Summary');
    expect(outputPanelText).toContain('100%');
    expect(outputPanelText).toContain('ExampleApexClass1Test.validateSayHello');
    expect(outputPanelText).toContain('ExampleApexClass2Test.validateSayHello');
    expect(outputPanelText).toContain('ExampleApexClass3Test.validateSayHello');
    expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    let icon;
    let iconStyle;

    for (const item of apexTestsItems){
      icon = await (await item.elem).$('.custom-view-tree-node-item-icon');
      iconStyle = await icon.getAttribute('style');
      expect(iconStyle).toContain('testPass');
    }
  });

  step('Run all Apex Tests on a Class via the Test Sidebar', async () => {
    const workbench = await browser.getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');

    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    expect(testingSideBarView).toBeInstanceOf(SideBarView);

    const sidebar = workbench.getSideBar();
    const sidebarView = sidebar.getContent();
    const apexTestsSection = await sidebarView.getSection('APEX TESTS');
    expect(apexTestsSection.elem).toBePresent();

    // Click the run test button that is shown to the right when you hover a test class name on the Test sidebar
    const apexTestItem = await apexTestsSection.findItem('ExampleApexClass2Test') as TreeItem;
    await apexTestItem.select();
    const runTestsAction = await apexTestItem.getActionButton('Run Tests');
    await runTestsAction!.elem.click();

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);
    }

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('=== Test Summary');
    expect(outputPanelText).toContain('TEST NAME');
    expect(outputPanelText).toContain('ExampleApexClass2Test.validateSayHello');
    expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    const icon = await (await apexTestItem.elem).$('.custom-view-tree-node-item-icon');
    const iconStyle = await icon.getAttribute('style');
    expect(iconStyle).toContain('testPass');
  });

  step('Run a Single Apex Test via the Test Sidebar', async () => {
    const workbench = await browser.getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');

    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    expect(testingSideBarView).toBeInstanceOf(SideBarView);

    const sidebar = workbench.getSideBar();
    const sidebarView = sidebar.getContent();
    const apexTestsSection = await sidebarView.getSection('APEX TESTS');
    expect(apexTestsSection.elem).toBePresent();

    // Hover a test name under one of the test class sections and click the run button that is shown to the right of the test name on the Test sidebar
    const apexTestItem = await apexTestsSection.findItem('validateSayHello') as TreeItem;
    await apexTestItem.select();
    const runTestAction = await apexTestItem.getActionButton('Run Single Test');
    await runTestAction!.elem.click();

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);
    }

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('=== Test Summary');
    expect(outputPanelText).toContain('TEST NAME');
    expect(outputPanelText).toContain('ExampleApexClass3Test.validateSayHello');
    expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar
    const icon = await (await apexTestItem.elem).$('.custom-view-tree-node-item-icon');
    const iconStyle = await icon.getAttribute('style');
    expect(iconStyle).toContain('testPass');
  });

  step('Run a test that fails and fix it', async () => {
    const workbench = await browser.getWorkbench();

    // Create Apex class AccountService
    await utilities.createApexClassWithBugs();

    // Push source to scratch org
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 1);

    // Run SFDX: Run Apex tests.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Run Apex Tests', 1);

    // Select the "AccountServiceTest" file
    await prompt.selectQuickPick('AccountServiceTest');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);
    }

    // Verify test results are listed on vscode's Output section
    let outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('Assertion Failed: incorrect ticker symbol');
    expect(outputPanelText).toContain('Expected: CRM, Actual: SFDC');

    // Fix test
    let textEditor: TextEditor;
    const editorView = workbench.getEditorView();
    textEditor = await editorView.openEditor('AccountService.cls') as TextEditor;
    await textEditor.setTextAtLine(6, '\t\t\tTickerSymbol = tickerSymbol');
    await textEditor.save();
    await utilities.pause(1);

    // Push source to scratch org
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 6);

    // Run SFDX: Run Apex tests to verify fix
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Run Apex Tests', 1);

    // Select the "AccountServiceTest" file
    await prompt.selectQuickPick('AccountServiceTest');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

    const successNotification2WasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests successfully ran');
    if (successNotification2WasFound !== true) {
      const failureNotification2WasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests failed to run');
      if (failureNotification2WasFound === true) {
        expect(successNotification2WasFound).toBe(false);
      }
    } else {
      expect(successNotification2WasFound).toBe(true);

      // Verify test results are listed on vscode's Output section
      outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
      expect(outputPanelText).not.toBeUndefined();
      expect(outputPanelText).toContain('AccountServiceTest.should_create_account');
      expect(outputPanelText).toContain('Pass');
    }
  });

  step('Create Apex Test Suite', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Create Apex Test Suite.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Create Apex Test Suite', 1);

    // Set the name of the new Apex Test Suite
    await prompt.setText('ApexTestSuite');
    await prompt.confirm();
    await utilities.pause(2);

    // Choose tests that will belong to the new Apex Test Suite
    await browser.keys(['ArrowDown']);
    await browser.keys(['Space']);
    await prompt.confirm();

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Build Apex Test Suite', 5 * 60);

    // Look for the success notification that appears which says, "SFDX: Build Apex Test Suite successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Build Apex Test Suite successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Build Apex Test Suite failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);
    }
  });

  step('Add test to Apex Test Suite', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Add Tests to Apex Test Suite.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Add Tests to Apex Test Suite', 1);

    // Select the suite recently created called ApexTestSuite
    await prompt.selectQuickPick('ApexTestSuite');
    await utilities.pause(2);

    // Choose tests that will belong to the already created Apex Test Suite
    await browser.keys(['ArrowDown']);
    await browser.keys(['ArrowDown']);
    await browser.keys([' ']);
    await prompt.confirm();

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Build Apex Test Suite', 5 * 60);

    // Look for the success notification that appears which says, "SFDX: Build Apex Test Suite successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX:  Build Apex Test Suite successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Build Apex Test Suite failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);
    }
  });

  step('Run Apex Test Suite', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Run Apex Test Suite.
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Run Apex Test Suite', 1);

    // Select the suite recently created called ApexTestSuite
    await prompt.selectQuickPick('ApexTestSuite');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

    // Look for the success notification that appears which says, "SFDX: Run Apex Tests successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Run Apex Tests failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);

      // Verify test results are listed on vscode's Output section
      const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
      expect(outputPanelText).not.toBeUndefined();
      expect(outputPanelText).toContain('=== Test Summary');
      expect(outputPanelText).toContain('TEST NAME');
      expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');
    }
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
