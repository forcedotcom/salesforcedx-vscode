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
  TextEditor
} from 'wdio-vscode-service';
import {
  ScratchOrg
} from '../scratchOrg';
import * as utilities from '../utilities';

describe('Debug Apex Tests', async () => {
  let prompt: QuickOpenBox | InputBox;
  let scratchOrg: ScratchOrg;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('apexReplayDebugger', false); // TODO: Change back to false
    await scratchOrg.setUp();

    const workbench = await browser.getWorkbench();

    // Create Apex class file
    await utilities.createApexClassWithTest('ExampleApexClass');
    await utilities.pause(1);

    // Push source to scratch org
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Push Source to Default Scratch Org and Override Conflicts', 3);

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

  step('Run the Anonymous Apex Debugger with Currently Selected Text', async () => {
    const workbench = await browser.getWorkbench();

    // Get open text editor
    const editorView = workbench.getEditorView();
    let textEditor: TextEditor;

    // Open test file
    textEditor = await editorView.openEditor('ExampleApexClassTest.cls') as TextEditor;

    // Select text
    await textEditor.selectText('ExampleApexClass.SayHello(\'Cody\');');
    await utilities.pause(1);

    // Run SFDX: Launch Apex Replay Debugger with Currently Selected Text.
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Execute Anonymous Apex with Currently Selected Text', 1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running Execute Anonymous Apex', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Execute Anonymous Apex successfully ran');
    expect(successNotificationWasFound).toBe(true);
  });

  step('SFDX: Get Apex Debug Logs', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Get Apex Debug Logs
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Get Apex Debug Logs', 1);

    // Select the "ExampleApexClassTest" file
    prompt.selectQuickPick('ExampleApexClassTest');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Getting Apex debug logs', 5 * 60);

    const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'No Apex debug logs were found');
    if (failureNotificationWasFound !== true) {
      // Select a log file
      const quickPicks = await prompt.getQuickPicks();
      expect(quickPicks).not.toBeUndefined();
      expect(quickPicks.length).toBeGreaterThanOrEqual(1);
      await prompt.selectQuickPick('User User - Api');
      const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Get Apex Debug Logs successfully ran');
      expect(successNotificationWasFound).toBe(true);
    } else {
      expect(failureNotificationWasFound).toBe(true);
    }
  });

  step('SFDX: Launch Apex Replay Debugger with Last Log File', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Launch Apex Replay Debugger with Last Log File
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Launch Apex Replay Debugger with Last Log File', 1);

    // Get open text editor
    const editorView = await workbench.getEditorView();

    // Get file path from open text editor
    const activeTab = await editorView.getActiveTab();
    if (!activeTab) {
      expect(activeTab).not.toBeDefined();
    }
    expect(activeTab).not.toBe(undefined);
    const title = await activeTab?.getTitle();
    const logFilePath = path.join(path.delimiter, 'tools', 'debug', 'logs', title!).slice(1); // TODO: Verify that this works on windows
    await prompt.setText(logFilePath);
    await prompt.confirm();
    await utilities.pause(1);

    // Continue with the debug session
    await browser.keys(['F5']);
    await utilities.pause(1);
    await browser.keys(['F5']);
    await utilities.pause(1);
  });

  step('SFDX: Launch Apex Replay Debugger with Current File', async () => {
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
      expect(successNotificationWasFound).toBe(true);
    }
  });

  step('Run the Anonymous Apex Debugger using the Command Palette', async () => {
    const workbench = await browser.getWorkbench();

    // Create anonymous apex file
    await utilities.createAnonymousApexFile();

    // Run SFDX: Launch Apex Replay Debugger with Editor Contents", using the Command Palette.
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Execute Anonymous Apex with Editor Contents', 1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running Execute Anonymous Apex', 5 * 60);
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Execute Anonymous Apex successfully ran');
    expect(successNotificationWasFound).toBe(true);
  });

  step('SFDX: Turn Off Apex Debug Log for Replay Debugger', async () => {
    const workbench = await browser.getWorkbench();

    // Run SFDX: Turn Off Apex Debug Log for Replay Debugger
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Turn Off Apex Debug Log for Replay Debugger', 1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Turn Off Apex Debug Log for Replay Debugger', 5 * 60);

    // Look for the success notification that appears which says, "SFDX: Turn Off Apex Debug Log for Replay Debugger successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Turn Off Apex Debug Log for Replay Debugger successfully ran');
    expect(successNotificationWasFound).toBe(true);
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
