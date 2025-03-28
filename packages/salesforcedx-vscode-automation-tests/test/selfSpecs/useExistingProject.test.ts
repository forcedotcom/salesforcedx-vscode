/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { step } from 'mocha-steps';
import { TestSetup } from '../testSetup';
import * as utilities from '../utilities/index';

describe('Use existing project', async () => {
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'UseExistingProject'
  };

  let testSetup: TestSetup;
  step('verify existing project is open', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
    utilities.log(`${testSetup.testSuiteSuffixName} - Verify existing project open`);
    await utilities.verifyProjectLoaded('dreamhouse-lwc-testing');
  });
});
