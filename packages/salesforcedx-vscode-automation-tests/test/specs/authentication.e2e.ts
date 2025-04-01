/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { step } from 'mocha-steps';
import { By, InputBox, after } from 'vscode-extension-tester';
import { EnvironmentSettings } from 'salesforcedx-vscode-automation-tests-redhat/test/environmentSettings';
import { TestSetup } from 'salesforcedx-vscode-automation-tests-redhat/test/testSetup';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';
import { expect } from 'chai';

describe('Authentication', async () => {
  let scratchOrgAliasName: string;
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'Authentication'
  };

  step('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
  });

  step('Run SFDX: Authorize a Dev Hub', async () => {
    // In the initial state, the org picker button should be set to "No Default Org Set".
    let noDefaultOrgSetItem = await utilities.getStatusBarItemWhichIncludes('No Default Org Set');
    expect(noDefaultOrgSetItem).to.not.be.undefined;

    // This is essentially the "SFDX: Authorize a Dev Hub" command, but using the CLI and an auth file instead of the UI.
    await utilities.authorizeDevHub(testSetup);
  });

  step('Run SFDX: Set a Default Org', async () => {
    // This is "SFDX: Set a Default Org", using the button in the status bar.
    // Could also run the command, "SFDX: Set a Default Org" but this exercises more UI elements.

    // Click on "No default Org Set" (in the bottom bar).
    const workbench = await utilities.getWorkbench();
    const changeDefaultOrgSetItem = await utilities.getStatusBarItemWhichIncludes('No Default Org Set');
    expect(changeDefaultOrgSetItem).to.not.be.undefined;
    await changeDefaultOrgSetItem.click();
    await utilities.pause(utilities.Duration.seconds(5));

    const orgPickerOptions = await workbench.findElements(
      By.css(
        'div.monaco-list#quickInput_list > div.monaco-scrollable-element > div.monaco-list-rows > div.monaco-list-row'
      )
    );
    // In the drop down menu that appears, verify the SFDX auth org commands are present...
    const expectedSfdxCommands = [
      ' SFDX: Authorize an Org',
      ' SFDX: Authorize a Dev Hub',
      ' SFDX: Create a Default Scratch Org...',
      ' SFDX: Authorize an Org using Session ID',
      ' SFDX: Remove Deleted and Expired Orgs'
    ];
    const foundSfdxCommands: string[] = [];
    for (const quickPick of orgPickerOptions) {
      const label = (await quickPick.getAttribute('aria-label')).slice(5);
      if (expectedSfdxCommands.includes(label)) {
        foundSfdxCommands.push(label);
      }
    }

    if (expectedSfdxCommands.length !== foundSfdxCommands.length) {
      // Something is wrong - the count of matching menus isn't what we expected.
      expectedSfdxCommands.forEach(async expectedSfdxCommand => {
        expect(foundSfdxCommands).to.contain(expectedSfdxCommand);
      });
    }

    // In the drop down menu that appears, select "vscodeOrg - user_name".
    const environmentSettings = EnvironmentSettings.getInstance();
    const devHubAliasName = environmentSettings.devHubAliasName;
    const devHubUserName = environmentSettings.devHubUserName;
    const inputBox = await InputBox.create();
    await inputBox.selectQuickPick(`${devHubAliasName} - ${devHubUserName}`);

    // Need to pause here for the "set a default org" command to finish.
    await utilities.pause(utilities.Duration.seconds(5));

    // Look for the notification that appears which says, "SFDX: Set a Default Org successfully ran".
    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Set a Default Org successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    const expectedOutputWasFound = await utilities.attemptToFindOutputPanelText(
      'Salesforce CLI',
      `target-org  ${devHubAliasName}  true`,
      5
    );
    expect(expectedOutputWasFound).to.not.be.undefined;

    // Look for "vscodeOrg" in the status bar.
    const statusBar = workbench.getStatusBar();
    const vscodeOrgItem = await statusBar.getItem(`plug  ${devHubAliasName}, Change Default Org`);
    expect(vscodeOrgItem).to.not.be.undefined;
  });

  step('Run SFDX: Create a Default Scratch Org', async () => {
    const prompt = await utilities.executeQuickPick(
      'SFDX: Create a Default Scratch Org...',
      utilities.Duration.seconds(1)
    );

    // Select a project scratch definition file (config/project-scratch-def.json)
    await prompt.confirm();

    // Enter an org alias - yyyy-mm-dd-username-ticks
    const currentDate = new Date();
    const ticks = currentDate.getTime();
    const day = ('0' + currentDate.getDate()).slice(-2);
    const month = ('0' + (currentDate.getMonth() + 1)).slice(-2);
    const year = currentDate.getFullYear();
    const currentOsUserName = utilities.transformedUserName();
    scratchOrgAliasName = `TempScratchOrg_${year}_${month}_${day}_${currentOsUserName}_${ticks}_OrgAuth`;

    await prompt.setText(scratchOrgAliasName);
    await utilities.pause(utilities.Duration.seconds(1));

    // Press Enter/Return.
    await prompt.confirm();

    // Enter the number of days.
    await prompt.setText('1');
    await utilities.pause(utilities.Duration.seconds(1));

    // Press Enter/Return.
    await prompt.confirm();

    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Create a Default Scratch Org\.\.\. successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    if (successNotificationWasFound !== true) {
      const failureNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
        /SFDX: Create a Default Scratch Org\.\.\. failed to run/,
        utilities.Duration.TEN_MINUTES
      );
      if (failureNotificationWasFound === true) {
        if (
          await utilities.attemptToFindOutputPanelText(
            'Salesforce CLI',
            'organization has reached its daily scratch org signup limit',
            5
          )
        ) {
          // This is a known issue...
          utilities.log('Warning - creating the scratch org failed, but the failure was due to the daily signup limit');
        } else if (await utilities.attemptToFindOutputPanelText('Salesforce CLI', 'is enabled as a Dev Hub', 5)) {
          // This is a known issue...
          utilities.log('Warning - Make sure that the org is enabled as a Dev Hub.');
          utilities.log(
            'Warning - To enable it, open the org in your browser, navigate to the Dev Hub page in Setup, and click Enable.'
          );
          utilities.log(
            'Warning - If you still see this error after enabling the Dev Hub feature, then re-authenticate to the org.'
          );
        } else {
          // The failure notification is showing, but it's not due to maxing out the daily limit.  What to do...?
          utilities.log('Warning - creating the scratch org failed... not sure why...');
        }
      } else {
        utilities.log(
          'Warning - creating the scratch org failed... neither the success notification or the failure notification was found.'
        );
      }
    }
    expect(successNotificationWasFound).to.equal(true);

    // Look for the org's alias name in the list of status bar items.
    const scratchOrgStatusBarItem = await utilities.getStatusBarItemWhichIncludes(scratchOrgAliasName);
    expect(scratchOrgStatusBarItem).to.not.be.undefined;
  });

  step('Run SFDX: Set the Scratch Org As the Default Org', async () => {
    const inputBox = await utilities.executeQuickPick('SFDX: Set a Default Org', utilities.Duration.seconds(10));

    const scratchOrgQuickPickItemWasFound = await utilities.findQuickPickItem(
      inputBox,
      scratchOrgAliasName,
      false,
      true
    );
    expect(scratchOrgQuickPickItemWasFound).to.equal(true);

    await utilities.pause(utilities.Duration.seconds(3));

    const successNotificationWasFound = await utilities.notificationIsPresentWithTimeout(
      /SFDX: Set a Default Org successfully ran/,
      utilities.Duration.TEN_MINUTES
    );
    expect(successNotificationWasFound).to.equal(true);

    // Look for the org's alias name in the list of status bar items.
    const scratchOrgStatusBarItem = await utilities.getStatusBarItemWhichIncludes(scratchOrgAliasName);
    expect(scratchOrgStatusBarItem).to.not.be.undefined;
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});
