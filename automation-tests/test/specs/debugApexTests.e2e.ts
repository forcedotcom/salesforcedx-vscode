/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'fs';
import { step } from 'mocha-steps';
import path from 'path';
import {
  InputBox,
  QuickOpenBox
} from 'wdio-vscode-service';
import {
  ScratchOrg
} from '../ScratchOrg';
import {
  utilities
} from '../utilities';

describe('Debug Apex Tests', async () => {
  const tempProjectName = 'TempProject-OrgCreationAndAuth';
  let prompt: QuickOpenBox | InputBox;
  let scratchOrg: ScratchOrg;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('DebugApexTests', true); // TODO: Change back to false
    await scratchOrg.setUp();
  });

  step('SFDX: Turn On Apex Debug Log for Replay Debugger', async () => {
    const workbench = await (await browser.getWorkbench()).wait();

    // Run SFDX: Turn On Apex Debug Log for Replay Debugger
    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Turn On Apex Debug Log for Replay Debugger');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Turn On Apex Debug Log for Replay Debugger', 5 * 60);
    await utilities.pause(10);

    // Look for the success notification that appears which says, "SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Turn On Apex Debug Log for Replay Debugger successfully ran');
    expect(successNotificationWasFound).toBe(true);

    /*
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Turn On Apex Debug Log for Replay Debugger... failed to run');
      if (failureNotificationWasFound === true) {
        if (await utilities.textIsPresentInOutputPanel(workbench, 'sfdx-cli update available from')) {
          // This is a known issue...
          utilities.log('Warning - Turning On Apex Debug Log for Replay Debugger failed, but the failure was due to the sfdx-cli being outdated');
        } else if (await utilities.textIsPresentInOutputPanel(workbench, 'The org cannot be found')) {
          // This is a known issue...
          utilities.log('Warning - Verify that the org still exists');
          utilities.log('Warning - If your org is newly created, wait a minute and run your command again.');
          utilities.log('Warning - If you deployed or updated the org\'s My Domain, logout from the CLI and authenticate again.');
          utilities.log('Warning - If you are running in a CI environment with a DNS that blocks external IPs, try setting SFDX_DISABLE_DNS_CHECK=true.');
        } else {
          // The failure notification is showing, but it's not due to a known reason.  What to do...?
          utilities.log('Warning - Turning On Apex Debug Log for Replay Debugger failed... not sure why...');
        }
      } else {
        utilities.log('Warning - Turning On Apex Debug Log for Replay Debugger failed... neither the success notification or the failure notification was found.');
      expect(failureNotificationWasFound).toBe(true);
      expect(successNotificationWasFound).toBe(false);
      }
    } else {
    }
    */
  });

  step('SFDX: Get Apex Debug Logs', async () => {
    const workbench = await (await browser.getWorkbench()).wait();

    // Run SFDX: Get Apex Debug Logs
    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Get Apex Debug Logs');
    await utilities.pause(1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Getting Apex debug logs', 5 * 60);
    await utilities.pause(5);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'Pick an Apex debug log to get');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'No Apex debug logs were found');
      expect(failureNotificationWasFound).toBe(true);
    } else {
      // Select the "Standard" project type.
      let quickPicks = await prompt.getQuickPicks();
      expect(quickPicks).not.toBeUndefined();
      expect(quickPicks.length).toBeGreaterThanOrEqual(1);
      // expect(await quickPicks[0].getLabel()).toEqual('Standard');
      await prompt.selectQuickPick('Standard');
      expect(successNotificationWasFound).toBe(true);
    }
  });

  step('SFDX: Launch Apex Replay Debugger with Current File', async () => {
    const workbench = await (await browser.getWorkbench()).wait();

    // Run SFDX: Launch Apex Replay Debugger with Current File
    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Launch Apex Replay Debugger with Current File');
    await utilities.pause(1);

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Launch Apex Replay Debugger with Current File...', 5 * 60);
    await utilities.pause(5);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Launch Apex Replay Debugger with Current File... successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'You can only run this command with Anonymous Apex files, Apex Test files, or Apex Debug Log files.');
      if (failureNotificationWasFound === true) {
        //TODO:
      } else {
        utilities.log('Warning - creating the scratch org failed... neither the success notification or the failure notification was found.');
      }
    }
    expect(successNotificationWasFound).toBe(true);
  });

  step('SFDX: Launch Apex Replay Debugger with Last Log File', async () => {
    const workbench = await (await browser.getWorkbench()).wait();
    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Launch Apex Replay Debugger with Last Log File');
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Launch Apex Replay Debugger with Last Log File...', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Launch Apex Replay Debugger with Last Log File... successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Launch Apex Replay Debugger with Last Log File... failed to run');
      if (failureNotificationWasFound === true) {
        //TODO:
      } else {
        utilities.log('Warning - creating the scratch org failed... neither the success notification or the failure notification was found.');
      }
    }
    expect(successNotificationWasFound).toBe(true);
  });

  step('Run the Anonymous Apex Debugger using the Right-Click Menu', async () => {
    // This is "SFDX: Execute Anonymous Apex with Currently Selected Text", using the Right-Click Menu.
    const workbench = await (await browser.getWorkbench()).wait();
    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Execute Anonymous Apex with Currently Selected Text');
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Execute Anonymous Apex with Currently Selected Text...', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Execute Anonymous Apex with Currently Selected Text... successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Execute Anonymous Apex with Currently Selected Text... failed to run');
      if (failureNotificationWasFound === true) {
        //TODO:
      } else {
        utilities.log('Warning - creating the scratch org failed... neither the success notification or the failure notification was found.');
      }
    }
    expect(successNotificationWasFound).toBe(true);
  });

  step('Run the Anonymous Apex Debugger using the Command Palette', async () => {
    // This is "SFDX: Execute Anonymous Apex with Editor Contents", using the Command Palette.
    const workbench = await (await browser.getWorkbench()).wait();
    await utilities.pause(1);

    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Execute Anonymous Apex with Editor Contents');
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Execute Anonymous Apex with Editor Contents...', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Execute Anonymous Apex with Editor Contents... successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Execute Anonymous Apex with Editor Contents... failed to run');
      if (failureNotificationWasFound === true) {
        //TODO:
      } else {
        utilities.log('Warning - creating the scratch org failed... neither the success notification or the failure notification was found.');
      }
    }
    expect(successNotificationWasFound).toBe(true);
  });

  step('SFDX: Turn Off Apex Debug Log for Replay Debugger', async () => {
    const workbench = await (await browser.getWorkbench()).wait();

    // Run SFDX: Turn Off Apex Debug Log for Replay Debugger
    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Turn Off Apex Debug Log for Replay Debugger');

    // Wait for the command to execute
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Turn Off Apex Debug Log for Replay Debugger', 5 * 60);
    await utilities.pause(5);

    // Look for the success notification that appears which says, "SFDX: Turn Off Apex Debug Log for Replay Debugger successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Turn Off Apex Debug Log for Replay Debugger successfully ran');
    expect(successNotificationWasFound).toBe(true);
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
    const tempFolderPath = getTempFolderPath();
    if (tempFolderPath) {
      await utilities.removeFolder(tempFolderPath);
    }
  });

  function getTempFolderPath(): string {
    return path.join(__dirname, '..', 'e2e-temp');
  }
});
