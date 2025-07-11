/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Duration,
  pause,
  ProjectShapeOption,
  TestReqConfig
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { EnvironmentSettings } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/environmentSettings';
import { verifyNotificationWithRetry } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/retryUtils';
import {
  authorizeDevHub,
  createDefaultScratchOrg
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  attemptToFindOutputPanelText,
  executeQuickPick,
  findQuickPickItem,
  getStatusBarItemWhichIncludes,
  getWorkbench
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { By, InputBox, after } from 'vscode-extension-tester';

describe('Authentication', () => {
  let scratchOrgAliasName: string;
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'Authentication'
  };

  before('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
  });

  // Since tests are sequential, we need to skip the rest of the tests if one fails
  beforeEach(function () {
    if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
      this.skip();
    }
  });

  it('Run SFDX: Authorize a Dev Hub', async () => {
    // In the initial state, the org picker button should be set to "No Default Org Set".
    const noDefaultOrgSetItem = await getStatusBarItemWhichIncludes('No Default Org Set');
    expect(noDefaultOrgSetItem).to.not.be.undefined;

    // This is essentially the "SFDX: Authorize a Dev Hub" command, but using the CLI and an auth file instead of the UI.
    await authorizeDevHub(testSetup);
  });

  it('Run SFDX: Set a Default Org', async () => {
    // This is "SFDX: Set a Default Org", using the button in the status bar.
    // Could also run the command, "SFDX: Set a Default Org" but this exercises more UI elements.

    // Click on "No default Org Set" (in the bottom bar).
    const workbench = await getWorkbench();
    const changeDefaultOrgSetItem = await getStatusBarItemWhichIncludes('No Default Org Set');
    expect(changeDefaultOrgSetItem).to.not.be.undefined;
    await changeDefaultOrgSetItem.click();
    await pause(Duration.seconds(5));

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
      expectedSfdxCommands.forEach(expectedSfdxCommand => {
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
    await pause(Duration.seconds(5));

    // Look for the notification that appears which says, "SFDX: Set a Default Org successfully ran".
    await verifyNotificationWithRetry(/SFDX: Set a Default Org successfully ran/, Duration.TEN_MINUTES);

    const expectedOutputWasFound = await attemptToFindOutputPanelText(
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

  it('Run SFDX: Create a Default Scratch Org', async () => {
    try {
      const orgAlias = await createDefaultScratchOrg();
      expect(orgAlias).to.be.a('string');
      scratchOrgAliasName = orgAlias;
    } catch (error) {
      throw new Error(`Failed to create scratch org: ${String(error)}`);
    }
  });

  it('Run SFDX: Set the Scratch Org As the Default Org', async () => {
    const inputBox = await executeQuickPick('SFDX: Set a Default Org', Duration.seconds(10));

    const scratchOrgQuickPickItemWasFound = await findQuickPickItem(inputBox, scratchOrgAliasName, false, true);
    expect(scratchOrgQuickPickItemWasFound).to.equal(true);

    await pause(Duration.seconds(3));

    await verifyNotificationWithRetry(/SFDX: Set a Default Org successfully ran/, Duration.TEN_MINUTES);

    // Look for the org's alias name in the list of status bar items.
    const scratchOrgStatusBarItem = await getStatusBarItemWhichIncludes(scratchOrgAliasName);
    expect(scratchOrgStatusBarItem).to.not.be.undefined;
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});
