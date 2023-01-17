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
  DefaultTreeItem,
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
  // const reuseScratchOrg = false;
  let projectFolderPath: string = undefined;
  let prompt: QuickOpenBox | InputBox = undefined;
  let scratchOrgAliasName: string = undefined;
  let scratchOrg: ScratchOrg = undefined;

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('debugApexTests', false);
    // Don't call scratchOrg.setUp(), just call setUpTestingEnvironment() and createProject().
    await scratchOrg.setUpTestingEnvironment();
    await scratchOrg.createProject();


    // This is "set up the testing environment", not "set up the global variables".

    const tempFolderPath = getTempFolderPath();
    projectFolderPath = path.join(tempFolderPath, tempProjectName);

    // Clean up the temp folder, just in case there are stale files there.
    if (fs.existsSync(projectFolderPath)) {
      utilities.removeFolder(projectFolderPath);
      await utilities.pause(1);
    }

    // Now create the folder.
    if (!fs.existsSync(tempFolderPath)) {
      await utilities.createFolder(tempFolderPath);
      await utilities.pause(1);
    }

    await utilities.createFolder(projectFolderPath);
    await utilities.pause(1);
  });

  step('SFDX: Turn On Apex Debug Log for Replay Debugger', async () => {
    const workbench = await (await browser.getWorkbench()).wait();
    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Turn On Apex Debug Log for Replay Debugger');
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Turn On Apex Debug Log for Replay Debugger...', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Turn On Apex Debug Log for Replay Debugger... successfully ran');
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
      }
    }
    expect(successNotificationWasFound).toBe(true);
  });

  step('SFDX: Get Apex Debug Logs', async () => {
    const workbench = await (await browser.getWorkbench()).wait();
    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Get Apex Debug Logs');
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Get Apex Debug Logs...', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Get Apex Debug Logs... successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Get Apex Debug Logs... failed to run');
      if (failureNotificationWasFound === true) {
        //TODO:
      } else {
        utilities.log('Warning - creating the scratch org failed... neither the success notification or the failure notification was found.');
      }
    }
    expect(successNotificationWasFound).toBe(true);
  });

  step('SFDX: Launch Apex Replay Debugger with Current File', async () => {
    const workbench = await (await browser.getWorkbench()).wait();
    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Launch Apex Replay Debugger with Current File');
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Launch Apex Replay Debugger with Current File...', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Launch Apex Replay Debugger with Current File... successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Launch Apex Replay Debugger with Current File... failed to run');
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
    prompt = await utilities.executeQuickPick(workbench, 'SFDX: Turn Off Apex Debug Log for Replay Debugger');
    await utilities.pause(1);
    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Turn Off Apex Debug Log for Replay Debugger...', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Turn Off Apex Debug Log for Replay Debugger... successfully ran');
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Turn Off Apex Debug Log for Replay Debugger... failed to run');
      if (failureNotificationWasFound === true) {
        //TODO:
      } else {
        utilities.log('Warning - creating the scratch org failed... neither the success notification or the failure notification was found.');
      }
    }
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

