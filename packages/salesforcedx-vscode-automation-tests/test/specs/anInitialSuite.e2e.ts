/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { step } from 'mocha-steps';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import { pause, Duration, log } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core/miscellaneous';
import { ProjectShapeOption, TestReqConfig } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core/types';
import {
  getWorkbench,
  zoom,
  zoomReset
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction/workbench';
import { openCommandPromptWithCommand } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction/commandPrompt';
import { after } from 'vscode-extension-tester';
import {
  findExtensionsInRunningExtensionsList,
  getExtensionsToVerifyActive
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing/extensionUtils';
/*
anInitialSuite.e2e.ts is a special case.  We want to validate that the Salesforce extensions and
most SFDX commands are not present at start up.

We also want to verify that after a project has been created, that the Salesforce extensions are loaded,
and that the SFDX commands are present.

Because of this requirement, this suite needs to run first before the other suites.  Since the
suites run in alphabetical order, this suite has been named so it runs first.

Please note that none of the other suites depend on this suite to run, it's just that if this
suite does run, it needs to run first.
*/

describe('An Initial Suite', async () => {
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'AnInitialSuite'
  };

  let testSetup: TestSetup;
  step('Verify our extensions are not initially loaded', async () => {
    await pause(Duration.seconds(20));
    await zoom('Out', 4, Duration.seconds(1));

    const foundSfExtensions = await findExtensionsInRunningExtensionsList(
      getExtensionsToVerifyActive().map((ext: { extensionId: string }) => ext.extensionId)
    );
    await zoomReset();
    if (foundSfExtensions.length > 0) {
      foundSfExtensions.forEach((ext: { extensionId: string }) => {
        log(
          `AnInitialSuite - extension ${ext.extensionId} was present, but wasn't expected before the extensions loaded`
        );
      });
      throw new Error('AnInitialSuite - extension was found before the extensions loaded');
    }
  });

  step('Verify the default SFDX commands are present when no project is loaded', async () => {
    const workbench = getWorkbench();
    const prompt = await openCommandPromptWithCommand(workbench, 'SFDX:');

    const quickPicks = await prompt.getQuickPicks();
    let expectedSfdxCommandsFound = 0;
    let unexpectedSfdxCommandWasFound = false;
    for (const quickPick of quickPicks) {
      const label = await quickPick.getLabel();
      switch (label) {
        // These three commands are expected to always be present,
        // even before the extensions have been loaded.
        case 'SFDX: Create and Set Up Project for ISV Debugging':
        case 'SFDX: Create Project':
        case 'SFDX: Create Project with Manifest':
          expectedSfdxCommandsFound++;
          break;

        default:
          // And if any other SFDX commands are present, this is unexpected and is an issue.
          unexpectedSfdxCommandWasFound = true;
          log(`AnInitialSuite - command ${label} was present, but wasn't expected before the extensions loaded`);
          break;
      }
    }

    expect(expectedSfdxCommandsFound).to.be.equal(3);
    expect(unexpectedSfdxCommandWasFound).to.be.false;

    // Escape out of the pick list.
    await prompt.cancel();
  });

  step('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
  });

  step('Verify that SFDX commands are present after an SFDX project has been created', async () => {
    const workbench = getWorkbench();
    const prompt = await openCommandPromptWithCommand(workbench, 'SFDX:');
    const quickPicks = await prompt.getQuickPicks();
    const commands = await Promise.all(
      quickPicks.map((quickPick: { getLabel: () => Promise<string> }) => quickPick.getLabel())
    );

    // Look for the first few SFDX commands.
    expect(commands).to.include('SFDX: Authorize a Dev Hub');
    expect(commands).to.include('SFDX: Authorize an Org');
    expect(commands).to.include('SFDX: Authorize an Org using Session ID');
    expect(commands).to.include('SFDX: Cancel Active Command');
    expect(commands).to.include('SFDX: Configure Apex Debug Exceptions');
    expect(commands).to.include('SFDX: Create a Default Scratch Org...');
    expect(commands).to.include('SFDX: Create and Set Up Project for ISV Debugging');
    expect(commands).to.include('SFDX: Create Apex Class');
    expect(commands).to.include('SFDX: Create Apex Trigger');
    // There are more, but just look for the first few commands.

    // Escape out of the pick list.
    await prompt.cancel();
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});
