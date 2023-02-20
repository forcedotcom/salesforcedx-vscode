/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import path from 'path';
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
    await utilities.pause(1);

    // Create Apex class 2 and test
    await utilities.createApexClassWithTest('ExampleApexClass2');
    await utilities.pause(1);

    // Create Apex class 3 and test
    await utilities.createApexClassWithTest('ExampleApexClass3');
    await utilities.pause(1);

    // Push source to scratch org
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 1);
    await utilities.pause(1);
  });

  step('Run All Tests via Apex Class', async () => {
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();
    let textEditor: TextEditor;

    // Open an existing apex test (e.g. BotTest.cls, search for @isTest)
    textEditor = await editorView.openEditor('ExampleApexClass1Test.cls') as TextEditor;

    // Click the "Run All Tests" code lens at the top of the class
    const codeLens = await textEditor.getCodeLens('Run All Tests') as CodeLens;
    await (await codeLens.elem).click();

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);
    await utilities.pause(1);

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
      expect(outputPanelText).toContain('ExampleApexClass1Test.validateSayHello');
      expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');
    }

  });

  step('Run Single Test via Apex Class', async () => {
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();
    let textEditor: TextEditor;

    // Open an existing apex test (e.g. BotTest.cls, search for @isTest)
    textEditor = await editorView.openEditor('ExampleApexClass2Test.cls') as TextEditor;

    // Click the "Run Test" code lens at the top of one of the test methods
    const codeLens = await textEditor.getCodeLens('Run Test') as CodeLens;
    await (await codeLens.elem).click();

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);
    await utilities.pause(1);

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
      expect(outputPanelText).toContain('ExampleApexClass2Test.validateSayHello');
      expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');
    }
  });

  step('Run Tests via Command Palette', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Run Apex tests.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Run Apex Tests', 1);
    await utilities.pause(1);

    // Select the "ExampleApexClassTest" file
    prompt.selectQuickPick('ExampleApexClass1Test');
    await utilities.pause(1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);
    await utilities.pause(1);

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
    await utilities.pause(1);

    // Open command palette and run "SFDX: Push Source to Default Scratch Org"
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 1);
    await utilities.pause(1);

    // Once push is successful, open command palette and run "SFDX: Re-Run Last Run Apex Test Class"
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts successfully ran');
    if (successNotificationWasFound) {
      prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Re-Run Last Run Apex Test Class', 1);
      await utilities.pause(1);
    } else {
      expect(successNotificationWasFound).toBe(false);
    }
  });

  step('Run all Apex tests via Test Sidebar - Missing: verify red/green dot color', async () => {
    const workbench = await browser.getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');

    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    expect(testingSideBarView).toBeInstanceOf(SideBarView);

    const sidebar = workbench.getSideBar();
    const sidebarView = sidebar.getContent();
    const apexTestsSection = await sidebarView.getSection('APEX TESTS');
    expect(apexTestsSection.elem).toBePresent();

    // Make sure all Apex tests in the project are listed
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
    await utilities.pause(1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);
    await utilities.pause(1);

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('=== Test Summary');
    expect(outputPanelText).toContain('TEST NAME');
    expect(outputPanelText).toContain('ExampleApexClass1Test.validateSayHello');
    expect(outputPanelText).toContain('ExampleApexClass2Test.validateSayHello');
    expect(outputPanelText).toContain('ExampleApexClass3Test.validateSayHello');
    expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar

    // Verify the tests that are failing have a red dot
  });

  step('Run all Apex Tests on a Class via the Test Sidebar - Missing: verify red/green dot color', async () => {
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
    await utilities.pause(1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);
    await utilities.pause(1);

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('=== Test Summary');
    expect(outputPanelText).toContain('TEST NAME');
    expect(outputPanelText).toContain('ExampleApexClass2Test.validateSayHello');
    expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar

    // Verify the tests that are failing have a red dot
  });

  step('Run a Single Apex Test via the Test Sidebar - Missing: verify red/green dot color', async () => {
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
    await utilities.pause(1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);
    await utilities.pause(1);

    // Verify test results are listed on vscode's Output section
    const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex', '=== Test Results', 10);
    expect(outputPanelText).not.toBeUndefined();
    expect(outputPanelText).toContain('=== Test Summary');
    expect(outputPanelText).toContain('TEST NAME');
    expect(outputPanelText).toContain('ExampleApexClass3Test.validateSayHello');
    expect(outputPanelText).toContain('ended SFDX: Run Apex Tests');

    // Verify the tests that are passing are labeled with a green dot on the Test sidebar

    // Verify the tests that are failing have a red dot
  });

  step('Run a test that fails', async () => {
    // TODO: guhlkb
  });

  step('Create and run Apex Test Suite', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Create Apex Test Suite.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Create Apex Test Suite', 1);
    await utilities.pause(1);

    // Run SFDX: Run Apex Test Suite.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Run Apex Test Suite', 1);
    await utilities.pause(1);
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
