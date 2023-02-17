/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import path from 'path';
import {
  InputBox,
  QuickOpenBox,
  SideBarView,
  TextEditor
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
  });

  // Run All Tests via Apex Class
  {
    step('Open an existing apex test (e.g. BotTest.cls, search for @isTest)', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Click the "Run All Tests" code lens at the top of the class', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  }
  // Run Single Test via Apex Class
  {
    step('Open an existing apex test (e.g. BotTest.cls)', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Click the "Run Test" code lens at the top of one of the test methods', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  }

  step('Run Tests via Command Palette', async () => {
    const workbench = await browser.getWorkbench();
    // Create Apex class file
    await utilities.createApexClassWithTest('ExampleApexClass');
    await utilities.pause(1);

    // Run SFDX: Run Apex tests.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Run Apex Tests', 1);
    await utilities.pause(1);

    // Select the "ExampleApexClassTest" file
    prompt.selectQuickPick('ExampleApexClassTest');
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

  step(' Re-run Last Apex Test Class', async () => {
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
    // const apexTest = await apexTestsSection.openItem('ExampleApexClassTest');
    textEditor = await editorView.openEditor('ExampleApexClassTest.cls') as TextEditor;
    await textEditor.setText('@isTest\npublic class ExampleApexClassTest {\n\t@isTest\n\tstatic void validateSayHello() {\n\t\tSystem.debug(\'Starting validate\');\n\t\tExampleApexClass.SayHello(\'Andres\');\n\t\tSystem.assertEquals(1, 1, \'all good\');\n\t}\n}');
    await textEditor.save();
    await textEditor.toggleBreakpoint(3);
    await utilities.pause(1);

    // Open command palette and run "SFDX: Push Source to Default Scratch Org"
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 1);
    await utilities.pause(1);

    // Once push is successful, open command palette and run "SFDX: Re-Run Last Run Apex Test Class"
    // prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Re-Run Last Run Apex Test Class', 1); // Not showing up
    // await utilities.pause(1);
    // TODO: success or failure part
  });
  // Run all Apex tests via Test Sidebar
  {
    step('Open the Test Sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Make sure all Apex tests in the project are listed', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Click the run tests button on the top right corner of the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are passing are labeled with a green dot on the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are failing have a red dot', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  }
  // Run all Apex Tests on a Class via the Test Sidebar
  {
    step('Open the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Make sure all Apex tests in the project are listed', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Click the run test button that is shown to the right when you hover a test class name on the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are passing are labeled with a green dot on the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are failing have a red dot', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });
  }
  // Run a Single Apex Test via the Test Sidebar
  {
    step('Open the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Make sure all Apex tests in the project are listed', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Hover a test name under one of the test class sections and click the run button that is shown to the right of the test name on the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify test results are listed on vscode\'s Output section', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are passing are labeled with a green dot on the Test sidebar', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Verify the tests that are failing have a red dot', async () => {
      // TODO: implement
      expect(1).toBe(1);
    });

    step('Tear down and clean up the testing environment', async () => {
      await scratchOrg.tearDown();
    });
  }
});
