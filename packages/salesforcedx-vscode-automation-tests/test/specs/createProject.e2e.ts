/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { step } from 'mocha-steps';
import { TestSetup } from '../testSetup';
import * as utilities from '../utilities/index';
import { after } from 'vscode-extension-tester';

describe('SFDX: Create Project', async () => {
  let testSetup: TestSetup;

  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NONE
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'sfdxCreateProject'
  };

  step('Set up testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
  });

  step('Execute command SFDX: Create Project', async () => {
    utilities.log(`Starting command SFDX: Create Project...`);
    const prompt = await utilities.executeQuickPick('SFDX: Create Project');
    await utilities.waitForQuickPick(prompt, 'Standard', {
      msg: 'Expected extension salesforcedx-core to be available within 5 seconds',
      timeout: utilities.Duration.seconds(5)
    });

    // Enter the project's name.
    await utilities.pause(utilities.Duration.seconds(1));
    await prompt.setText(testSetup.tempProjectName);
    await utilities.pause(utilities.Duration.seconds(2));

    // Press Enter/Return.
    await prompt.confirm();

    // Set the location of the project.
    await prompt.setText(testSetup.tempFolderPath!);
    await utilities.pause(utilities.Duration.seconds(2));
    await utilities.clickFilePathOkButton();
    await utilities.pause(utilities.Duration.seconds(2));
  });

  step('Verify the project is created and open in the workspace', async () => {
    // Verify the project was created and was loaded.
    await utilities.verifyProjectLoaded(testSetup.tempProjectName);
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});
