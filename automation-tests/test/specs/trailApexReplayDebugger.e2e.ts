/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import {
  InputBox,
  QuickOpenBox,
  TextEditor
} from 'wdio-vscode-service';
import {
  ScratchOrg
} from '../scratchOrg';
import * as utilities from '../utilities';

describe('Find and Fix Bugs with Apex Replay Debugger', async () => {
  let prompt: QuickOpenBox | InputBox;
  let scratchOrg: ScratchOrg;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('TrailApexReplayDebugger', true); // TODO: Change back to false
    await scratchOrg.setUp();

    const workbench = await browser.getWorkbench();

    // Create Apex class AccountService
    await utilities.createApexClassWithBugs();

    // Push source to scratch org
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 6);
  });

  step('Run Apex Tests', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Run Apex tests.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Run Apex Tests', 1);

    // Select the "AccountServiceTest" file
    await prompt.selectQuickPick('AccountServiceTest');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

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
      expect(outputPanelText).toContain('Assertion Failed: incorrect ticker symbol');
      expect(outputPanelText).toContain('Expected: CRM, Actual: SFDC');
    }
  });

  step('Set Breakpoints and Checkpoints', async () => {
    const workbench = await browser.getWorkbench();
    let textEditor: TextEditor;

    const editorView = workbench.getEditorView();
    textEditor = await editorView.openEditor('AccountService.cls') as TextEditor;
    await textEditor.moveCursor(8, 5);

    // Run SFDX: Toggle Checkpoint.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Toggle Checkpoint', 1);

    // Run SFDX: Update Checkpoints in Org.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Update Checkpoints in Org', 1);

    // // Verify checkpoints updating results are listed on vscode's Output section
    // const outputPanelText = await utilities.attemptToFindOutputPanelText('Apex Replay Debugger', 'Starting SFDX: Update Checkpoints in Org', 10);
    // expect(outputPanelText).not.toBeUndefined();
    // expect(outputPanelText).toContain('SFDX: Update Checkpoints in Org, Step 6 of 6: Confirming successful checkpoint creation');
    // expect(outputPanelText).toContain('Ending SFDX: Update Checkpoints in Org');
  });

  step('SFDX: Turn On Apex Debug Log for Replay Debugger', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Turn On Apex Debug Log for Replay Debugger
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Turn On Apex Debug Log for Replay Debugger', 1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Turn On Apex Debug Log for Replay Debugger', 5 * 60);

    // Look for the success notification that appears which says, "SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran');
    expect(successNotificationWasFound).toBe(true);
  });

  step('Run Apex Tests', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Run Apex tests.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Run Apex Tests', 1);

    // Select the "AccountServiceTest" file
    await prompt.selectQuickPick('AccountServiceTest');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

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
      expect(outputPanelText).toContain('Assertion Failed: incorrect ticker symbol');
      expect(outputPanelText).toContain('Expected: CRM, Actual: SFDC');
    }
  });

  step('SFDX: Get Apex Debug Logs', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Get Apex Debug Logs
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Get Apex Debug Logs', 1);

    // Select the "AccountServiceTest" file
    await prompt.selectQuickPick('AccountServiceTest');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Getting Apex debug logs', 5 * 60);

    const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'No Apex debug logs were found');
    if (failureNotificationWasFound !== true) {
      // Select a log file
      const quickPicks = await prompt.getQuickPicks();
      expect(quickPicks).not.toBeUndefined();
      expect(quickPicks.length).toBeGreaterThanOrEqual(1);
      await prompt.selectQuickPick('User User - ApexTestHandler');

      // Wait for the command to execute
      await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Get Apex Debug Logs', 5 * 60);

      const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Get Apex Debug Logs successfully ran');
      expect(successNotificationWasFound).toBe(true);
    } else {
      expect(failureNotificationWasFound).toBe(true);
    }
  });

  step('Replay an Apex Debug Log', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Launch Apex Replay Debugger with Current File
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Launch Apex Replay Debugger with Current File', 1);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Launch Apex Replay Debugger with Current File successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'You can only run this command with Anonymous Apex files, Apex Test files, or Apex Debug Log files.');
      if (failureNotificationWasFound === true) {
        expect(successNotificationWasFound).toBe(false);
      } else {
        utilities.log('Warning - Launching Apex Replay Debugger with Current File failed, neither the success notification or the failure notification was found.');
      }
    } else {
      // Continue with the debug session
      await utilities.pause(5);
      await browser.keys(['F5']);
      await utilities.pause(1);
      await browser.keys(['F5']);
      await utilities.pause(1);
      expect(successNotificationWasFound).toBe(true);
    }
  });

  step('Push Fixed Metadata to Scratch Org', async () => {
    const workbench = await browser.getWorkbench();
    let textEditor: TextEditor;

    const editorView = workbench.getEditorView();
    textEditor = await editorView.openEditor('AccountService.cls') as TextEditor;
    await textEditor.setTextAtLine(6, '\t\t\tTickerSymbol = tickerSymbol');
    await textEditor.save();
    await utilities.pause(1);

    // Push source to scratch org
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 6);
  });

  step('Run Apex Tests to Verify Fix', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Run Apex tests.
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Run Apex Tests', 1);

    // Select the "AccountServiceTest" file
    await prompt.selectQuickPick('AccountServiceTest');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Listening for streaming state changes...', 5 * 60);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Run Apex Tests: Processing test run', 5 * 60, false);

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
      expect(outputPanelText).toContain('AccountServiceTest.should_create_account');
      expect(outputPanelText).toContain('Pass');
    }
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
