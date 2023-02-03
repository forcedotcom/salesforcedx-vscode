/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import fs from 'fs';
import {
  step
} from 'mocha-steps';
import path from 'path';
import {
  DefaultTreeItem,
  InputBox,
  QuickOpenBox
} from 'wdio-vscode-service';
import {
  EnvironmentSettings
} from '../environmentSettings';
import * as utilities from '../utilities';

describe('Org Creation and Authentication', async () => {
  const tempProjectName = 'TempProject-OrgCreationAndAuth';
  let tempFolderPath: string;
  let projectFolderPath: string;
  let prompt: QuickOpenBox | InputBox;
  let scratchOrgAliasName: string;

  step('Set up the testing environment', async () => {
    tempFolderPath = getTempFolderPath();
    projectFolderPath = path.join(tempFolderPath, tempProjectName);

    // Remove the project folder, just in case there are stale files there.
    if (fs.existsSync(projectFolderPath)) {
      utilities.removeFolder(projectFolderPath);
      await utilities.pause(1);
    }

    // Now create the temp folder.  It should exists but create the folder if it is missing.
    if (!fs.existsSync(tempFolderPath)) {
      await utilities.createFolder(tempFolderPath);
      await utilities.pause(1);
    }
  });

  step('Run SFDX: Create Project', async () => {
    const workbench = await browser.getWorkbench();
    prompt = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Create Project', 10);
    // Selecting "SFDX: Create Project" causes the extension to be loaded, and this takes a while.

    // Select the "Standard" project type.
    let quickPicks = await prompt.getQuickPicks();
    expect(quickPicks).not.toBeUndefined();
    expect(quickPicks.length).toBeGreaterThanOrEqual(1);
    expect(quickPicks.length).toEqual(3);
    expect(await quickPicks[0].getLabel()).toEqual('Standard');
    expect(await quickPicks[1].getLabel()).toEqual('Empty');
    expect(await quickPicks[2].getLabel()).toEqual('Analytics');
    await prompt.selectQuickPick('Standard');
    await utilities.pause(1);

    // Enter "TempProject-OrgCreationAndAuth" for the project name.
    await prompt.setText(tempProjectName);
    await utilities.pause(1);

    // Press Enter/Return.
    await prompt.confirm();

    // Set the location of the project.
    const input = await prompt.input$;
    await input.setValue(tempFolderPath);
    await utilities.pause(1);

    // Click the OK button.
    await utilities.clickFilePathOkButton();

    // Verify the project was created and was loaded.
    const sidebar = workbench.getSideBar();
    const content = sidebar.getContent();
    const treeViewSection = await content.getSection(tempProjectName.toUpperCase());
    expect(treeViewSection).not.toEqual(undefined);

    const forceAppTreeItem = await treeViewSection.findItem('force-app') as DefaultTreeItem;
    expect(forceAppTreeItem).not.toEqual(undefined);

    await forceAppTreeItem.expand();

    // Yep, we need to wait a long time here.
    await utilities.pause(10);
  });

  step('Run SFDX: Authorize a Dev Hub', async () => {
    // This is essentially the "SFDX: Authorize a Dev Hub" command, but using the CLI and an auth file instead of the UI.
    const workbench = await browser.getWorkbench();
    await utilities.pause(1);

    const authFilePath = path.join(projectFolderPath, 'authFile.json');
    const terminalView = await utilities.executeCommand(workbench, `sfdx force:org:display -u ${EnvironmentSettings.getInstance().devHubAliasName} --verbose --json > ${authFilePath}`);

    const authFilePathFileExists = fs.existsSync(authFilePath);
    expect(authFilePathFileExists).toEqual(true);

    await terminalView.executeCommand(`sfdx auth:sfdxurl:store -d -f ${authFilePath}`);

    const terminalText = await utilities.getTerminalViewText(terminalView, 60);
    expect(terminalText).toContain(`Successfully authorized ${EnvironmentSettings.getInstance().devHubUserName} with org ID`);
  });

  step('Run SFDX: Set a Default Org', async () => {
    // This is "SFDX: Set a Default Org", using the button in the status bar.
    // Could also run the command, "SFDX: Set a Default Org" but this exercises more UI elements.

    // Click on "No default Org Set" (in the bottom bar).
    const workbench = await browser.getWorkbench();
    const statusBar = workbench.getStatusBar();
    const changeDefaultOrgSetItem = await utilities.getStatusBarItemWhichIncludes(statusBar, 'Change Default Org');
    expect(changeDefaultOrgSetItem).not.toBeUndefined();
    await changeDefaultOrgSetItem.click();
    await utilities.pause(1);

    // In the drop down menu that appears, select "vscodeOrg - user_name".
    await utilities.selectQuickPickItem(prompt, `${EnvironmentSettings.getInstance().devHubAliasName} - ${EnvironmentSettings.getInstance().devHubUserName}`);

    // Need to pause here for the "set a default org" command to finish.
    await utilities.pause(5);

    // Look for the notification that appears which says, "SFDX: Set a Default Org successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Set a Default Org successfully ran');
    expect(successNotificationWasFound).toBe(true);

    const expectedOutputWasFound = await utilities.attemptToFindOutputPanelText('Salesforce CLI', `defaultusername  ${EnvironmentSettings.getInstance().devHubAliasName}  true`, 5);
    expect(expectedOutputWasFound).not.toBeUndefined();

    // Look for "vscodeOrg" in the status bar.
    const vscodeOrgItem = await statusBar.getItem(`plug  ${EnvironmentSettings.getInstance().devHubAliasName}, Change Default Org`);
    expect(vscodeOrgItem).not.toBeUndefined();
  });

  step('Run SFDX: Create a Default Scratch Org', async () => {
    const workbench = await browser.getWorkbench();
    await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Create a Default Scratch Org...', 1);

    // Select a project scratch definition file (config/project-scratch-def.json)
    // Press Enter/Return to use the default (config/project-scratch-def.json)
    await prompt.confirm();

    // Enter an org alias - yyyy-mm-dd-username-ticks
    const currentDate = new Date();
    const ticks = currentDate.getTime();
    const day = ("0" + currentDate.getDate()).slice(-2);
    const month = ("0" + (currentDate.getMonth() + 1)).slice(-2);
    const year = currentDate.getFullYear();
    const currentOsUserName = utilities.currentOsUserName();
    scratchOrgAliasName = `TempScratchOrg_${year}_${month}_${day}_${currentOsUserName}_${ticks}_OrgAuth`;

    await prompt.setText(scratchOrgAliasName);
    await utilities.pause(1);

    // Press Enter/Return.
    await prompt.confirm();

    // Enter the number of days.
    await prompt.setText('1');
    await utilities.pause(1);

    // Press Enter/Return.
    await prompt.confirm();

    await utilities.waitForNotificationToGoAway(workbench, 'Running SFDX: Create a Default Scratch Org...', 5 * 60);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Create a Default Scratch Org... successfully ran');
    if (successNotificationWasFound != true) {
      const failureNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Create a Default Scratch Org... failed to run');
      if (failureNotificationWasFound == true) {
        if (await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'organization has reached its daily scratch org signup limit', 5)) {
          // This is a known issue...
          utilities.log('Warning - creating the scratch org failed, but the failure was due to the daily signup limit');
        } else if (await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'is enabled as a Dev Hub', 5)) {
          // This is a known issue...
          utilities.log('Warning - Make sure that the org is enabled as a Dev Hub.');
          utilities.log('Warning - To enable it, open the org in your browser, navigate to the Dev Hub page in Setup, and click Enable.');
          utilities.log('Warning - If you still see this error after enabling the Dev Hub feature, then re-authenticate to the org.');
        } else {
          // The failure notification is showing, but it's not due to maxing out the daily limit.  What to do...?
          utilities.log('Warning - creating the scratch org failed... not sure why...');
        }
      } else {
        utilities.log('Warning - creating the scratch org failed... neither the success notification or the failure notification was found.');
      }
    }
    expect(successNotificationWasFound).toBe(true);

    // Look for orgAliasName in the list of status bar items.
    const statusBar = await workbench.getStatusBar();
    const scratchOrgStatusBarItem = await utilities.getStatusBarItemWhichIncludes(statusBar, scratchOrgAliasName);
    expect(scratchOrgStatusBarItem).not.toBeUndefined();
  });

  step('Run SFDX: Set a Default Org', async () => {
    const workbench = await browser.getWorkbench();
    const inputBox = await utilities.runCommandFromCommandPrompt(workbench, 'SFDX: Set a Default Org', 1);

    let scratchOrgQuickPickItemWasFound = false;
    const currentOsUserName = await utilities.currentOsUserName();
    const quickPicks = await inputBox.getQuickPicks();
    for (const quickPick of quickPicks) {
      const label = await quickPick.getLabel();
      if (scratchOrgAliasName) {
        // Find the org that was created in the "Run SFDX: Create a Default Scratch Org" step.
        if (label.includes(scratchOrgAliasName)) {
          await quickPick.select();
          await utilities.pause(3);
          scratchOrgQuickPickItemWasFound = true;
          break;
        }
      } else {
        // If the scratch org was already created (and not deleted),
        // and the "Run SFDX: Create a Default Scratch Org" step was skipped,
        // scratchOrgAliasName is undefined and as such, search for the first org
        // that starts with "TempScratchOrg_" and also has the current user's name.
        if (label.startsWith('TempScratchOrg_') && label.includes(currentOsUserName)) {
          scratchOrgAliasName = label.split(' - ')[0];
          await quickPick.select();
          await utilities.pause(3);
          scratchOrgQuickPickItemWasFound = true;
          break;
        }
      }
    }
    expect(scratchOrgQuickPickItemWasFound).toBe(true);

    const successNotificationWasFound = await utilities.notificationIsPresent(workbench, 'SFDX: Set a Default Org successfully ran');
    expect(successNotificationWasFound).toBe(true);

    // Look for orgAliasName in the list of status bar items.
    const statusBar = await workbench.getStatusBar();
    const scratchOrgStatusBarItem = await utilities.getStatusBarItemWhichIncludes(statusBar, scratchOrgAliasName);
    expect(scratchOrgStatusBarItem).not.toBeUndefined();
  });

  step('Tear down', async () => {
    if (scratchOrgAliasName) {
      const workbench = await browser.getWorkbench();
      await utilities.executeCommand(workbench, `sfdx force:org:delete -u ${scratchOrgAliasName} --noprompt`);
    }

    const tempFolderPath = getTempFolderPath();
    if (tempFolderPath) {
      await utilities.removeFolder(tempFolderPath);
    }
  });

  function getTempFolderPath(): string {
    return path.join(__dirname, '..', '..', 'e2e-temp');
  }
});
