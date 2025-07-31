/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  TestReqConfig,
  ProjectShapeOption,
  pause,
  Duration
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { log } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core/miscellaneous';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  executeQuickPick,
  waitForQuickPick,
  clickFilePathOkButton,
  verifyProjectLoaded
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';

describe('SFDX: Create Project', () => {
  let testSetup: TestSetup;

  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NONE
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'sfdxCreateProject',
    extensionConfigs: defaultExtensionConfigs
  };

  before('Set up testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);

    // Hide copilot
    await tryToHideCopilot();
  });

  it('Execute command SFDX: Create Project', async () => {
    log('Starting command SFDX: Create Project...');
    const prompt = await executeQuickPick('SFDX: Create Project');
    await waitForQuickPick(prompt, 'Standard', {
      msg: 'Expected extension salesforcedx-core to be available within 5 seconds',
      timeout: Duration.seconds(5)
    });

    // Enter the project's name.
    await pause(Duration.seconds(1));
    await prompt.setText(testSetup.tempProjectName);
    await pause(Duration.seconds(2));

    // Press Enter/Return.
    await prompt.confirm();

    // Set the location of the project.
    await prompt.setText(testSetup.tempFolderPath!);
    await pause(Duration.seconds(2));
    await clickFilePathOkButton();
    await pause(Duration.seconds(2));
  });

  it('Verify the project is created and open in the workspace', async () => {
    // Verify the project was created and was loaded.
    await verifyProjectLoaded(testSetup.tempProjectName);
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});
