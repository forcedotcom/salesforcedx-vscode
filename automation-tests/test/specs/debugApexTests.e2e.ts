/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import {
  CodeLens,
  SideBarView,
  TextEditor,
  TreeItem
} from 'wdio-vscode-service';
import {
  ScratchOrg
} from '../scratchOrg';
import * as utilities from '../utilities';

describe('Debug Apex Tests', async () => {
  let scratchOrg: ScratchOrg;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('DebugApexTests', true); // TODO: Change back to false
    await scratchOrg.setUp();

    const workbench = await browser.getWorkbench();

    // Create Apex class 1 and test
    await utilities.createApexClassWithTest('ExampleApexClass1');
    await utilities.pause(1);

    // Create Apex class 2 and test
    await utilities.createApexClassWithTest('ExampleApexClass2');
    await utilities.pause(1);

    // Push source to scratch org
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 5);
  });

  step('Debug All Tests via Apex Class', async () => {
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();
    let textEditor: TextEditor;

    // Open an existing apex test (e.g. BotTest.cls, search for @isTest)
    textEditor = await editorView.openEditor('ExampleApexClass1Test.cls') as TextEditor;

    // Click the "Debug All Tests" code lens at the top of the class
    const codeLens = await textEditor.getCodeLens('Run All Tests') as CodeLens; // TODO: Change to Debug All Tests
    await (await codeLens.elem).click();

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running Debug Test(s)', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Debug Test(s) successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Debug Test(s) failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);

      // Continue with the debug session
      await browser.keys(['F5']);
      await utilities.pause(1);
      await browser.keys(['F5']);
      await utilities.pause(1);
    }

  });

  step('Debug Single Test via Apex Class', async () => {
    const workbench = await browser.getWorkbench();
    const editorView = workbench.getEditorView();
    let textEditor: TextEditor;

    // Open an existing apex test (e.g. BotTest.cls, search for @isTest)
    textEditor = await editorView.openEditor('ExampleApexClass2Test.cls') as TextEditor;

    // Click the "Debug Test" code lens at the top of one of the test methods
    const codeLens = await textEditor.getCodeLens('Run Test') as CodeLens; // TODO: Change to Debug Test
    await (await codeLens.elem).click();

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running Debug Test(s)', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Debug Test(s) successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Debug Test(s) failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);

      // Continue with the debug session
      await browser.keys(['F5']);
      await utilities.pause(1);
      await browser.keys(['F5']);
      await utilities.pause(1);
    }
  });

  step('Debug all Apex Methods on a Class via the Test Sidebar', async () => {
    const workbench = await browser.getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');

    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    expect(testingSideBarView).toBeInstanceOf(SideBarView);

    const sidebar = workbench.getSideBar();
    const sidebarView = sidebar.getContent();
    const apexTestsSection = await sidebarView.getSection('APEX TESTS');
    expect(apexTestsSection.elem).toBePresent();

    // Click the debug tests button that is shown to the right when you hover a test class name on the Test sidebar
    const apexTestItem = await apexTestsSection.findItem('ExampleApexClass1Test') as TreeItem;
    await apexTestItem.select();
    const runTestsAction = await apexTestItem.getActionButton('Debug Tests');
    await runTestsAction!.elem.click();
    await utilities.pause(1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running Debug Test(s)', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Debug Test(s) successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Debug Test(s) failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);

      // Continue with the debug session
      await browser.keys(['F5']);
      await utilities.pause(1);
      await browser.keys(['F5']);
      await utilities.pause(1);
    }
  });

  step('Debug a Single Apex Test Method via the Test Sidebar', async () => {
    const workbench = await browser.getWorkbench();
    const testingView = await workbench.getActivityBar().getViewControl('Testing');

    // Open the Test Sidebar
    const testingSideBarView = await testingView?.openView();
    expect(testingSideBarView).toBeInstanceOf(SideBarView);

    const sidebar = workbench.getSideBar();
    const sidebarView = sidebar.getContent();
    const apexTestsSection = await sidebarView.getSection('APEX TESTS');
    expect(apexTestsSection.elem).toBePresent();

    // Hover a test name under one of the test class sections and click the debug button that is shown to the right of the test name on the Test sidebar
    const apexTestItem = await apexTestsSection.findItem('validateSayHello') as TreeItem;
    await apexTestItem.select();
    const runTestAction = await apexTestItem.getActionButton('Debug Single Test');
    await runTestAction!.elem.click();
    await utilities.pause(1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running Debug Test(s)', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Debug Test(s) successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Debug Test(s) failed to run');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      }
    } else {
      expect(successNotificationWasFound).toBe(true);

      // Continue with the debug session
      await browser.keys(['F5']);
      await utilities.pause(1);
      await browser.keys(['F5']);
      await utilities.pause(1);
    }
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
