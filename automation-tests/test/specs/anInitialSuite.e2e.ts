/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import {
  ScratchOrg2 as ScratchOrg
} from '../ScratchOrg2';
import {
  utilities
} from '../utilities';

/*
anInitialSuite.e2e.ts is a special case.  We want to validate that the Salesforce extensions and
most SFDX commands are not present at start up, and we also want to verify that the Salesforce
extensions are loaded, and that the SFDX commands are present, after a project has been created.

Because of this requirement, this suite needs to run first before the other suites.  Since the
suites run alphabetically, this suite has been named so it runs first.
*/

describe('An Initial Suite', async () => {
  let scratchOrg: ScratchOrg = undefined;

  step('Verify our extensions are not initially loaded', async () => {
    const workbench = await (await browser.getWorkbench()).wait();
    await utilities.executeQuickPick(workbench, 'Developer: Show Running Extensions');
    await utilities.pause(2);

    const extensionNameDivs = await $$('div.name');
    let sfdxKeywordWasFound = false;
    let salesforceKeywordWasFound = false;
    for (const extensionNameDiv of extensionNameDivs) {
      const text = await extensionNameDiv.getText();

      if (text.includes('sfdx')) {
        sfdxKeywordWasFound = true;
        console.log(`AnInitialSuite - extension ${text} was present, but wasn't expected`);
      } else if (text.includes('salesforce')) {
        if (text !== 'salesforce.system-tests') {
          // salesforce.system-tests is expected, anything else is an issue.
          salesforceKeywordWasFound = true;
          console.log(`AnInitialSuite - extension ${text} was present, but wasn't expected before the extensions loaded`);
        }
      }
    }
    expect(sfdxKeywordWasFound).toBe(false);
    expect(salesforceKeywordWasFound).toBe(false);
  });

  step('Verify the default SFDX commands are present when no project is loaded', async () => {
    const workbench = await (await browser.getWorkbench()).wait();
    const prompt = await utilities.openCommandPromptWithCommand(workbench, 'SFDX:');

    let quickPicks = await prompt.getQuickPicks();
    let unexpectedSfdxCommandWasFound = false;
    for (const quickPick of quickPicks) {
      const label = await quickPick.getLabel();
      switch (label) {
        case 'SFDX: Create and Set Up Project for ISV Debugging':
        case 'SFDX: Create Project':
        case 'SFDX: Create Project with Manifest':
          break;

        default:
          unexpectedSfdxCommandWasFound = true;
          console.log(`AnInitialSuite - command ${label} was present, but wasn't expected before the extensions loaded`);
          break;
      }
    }
    expect(unexpectedSfdxCommandWasFound).toBe(false);

    // Escape out of the pick list.
    await prompt.cancel();
  });

  step('Set up the testing environment', async () => {
    scratchOrg = new ScratchOrg('AnInitialSuite', false);
    // Don't call scratchOrg.setUp(), just call setUpTestingEnvironment() and createProject().
    await scratchOrg.setUpTestingEnvironment();
    await scratchOrg.createProject();
  });

  step('Verify our extensions are loaded after creating an SFDX project', async () => {
    const workbench = await (await browser.getWorkbench()).wait();
    await utilities.executeQuickPick(workbench, 'Developer: Show Running Extensions');
    await utilities.pause(2);

    const extensionNameDivs = await $$('div.name');
    let matchesFound = 0;
    for (const extensionNameDiv of extensionNameDivs) {
      const text = await extensionNameDiv.getText();

      if (text.startsWith('salesforce.salesforcedx-vscode-')) {
        matchesFound++;
        console.log(`AnInitialSuite - extension ${text} is loaded`);
      }
    }
    expect(matchesFound).toBe(4);
  });

  step('Verify that SFDX commands are present after SFDX project has been created', async () => {
    const workbench = await (await browser.getWorkbench()).wait();
    const prompt = await utilities.openCommandPromptWithCommand(workbench, 'SFDX:');
    let quickPicks = await prompt.getQuickPicks();
    let commands: string[] = [];
    for (const quickPick of quickPicks) {
      commands.push(await quickPick.getLabel());
    }

    expect(commands).toContain('SFDX: Add Tests to Apex Test Suite');
    expect(commands).toContain('SFDX: Authorize a Dev Hub');
    expect(commands).toContain('SFDX: Authorize an Org');
    expect(commands).toContain('SFDX: Authorize an Org using Session ID');
    expect(commands).toContain('SFDX: Cancel Active Command');
    expect(commands).toContain('SFDX: Configure Apex Debug Exceptions');
    expect(commands).toContain('SFDX: Create a Default Scratch Org...');
    expect(commands).toContain('SFDX: Create Apex Class');
    expect(commands).toContain('SFDX: Create Apex Test Suite');
    expect(commands).toContain('SFDX: Create Apex Trigger');

    // Escape out of the pick list
    await prompt.cancel();
  });

  step('Tear down and clean up the testing environment', async () => {
    await scratchOrg.tearDown();
  });
});
