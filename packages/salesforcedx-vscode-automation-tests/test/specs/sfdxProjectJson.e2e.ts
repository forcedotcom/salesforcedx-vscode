/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  pause,
  TestReqConfig,
  ProjectShapeOption
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { createOrOverwriteFile } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import {
  getExtensionsToVerifyActive,
  reloadAndEnableExtensions,
  verifyExtensionsAreRunning
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import { expect } from 'chai';
import * as path from 'node:path';
import { after } from 'vscode-extension-tester';
import { defaultExtensionConfigs } from '../testData/constants';
import { tryToHideCopilot } from '../utils/copilotHidingHelper';

describe('Customize sfdx-project.json', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'sfdxProjectJson',
    extensionConfigs: defaultExtensionConfigs
  };

  before('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);

    // Hide copilot
    await tryToHideCopilot();

    await createSfdxProjectJsonWithAllFields(testSetup);
    await reloadAndEnableExtensions();
  });

  it('Verify our extensions are loaded after updating sfdx-project.json', async () => {
    expect(
      await verifyExtensionsAreRunning(
        getExtensionsToVerifyActive(ext =>
          defaultExtensionConfigs.some(config => config.extensionId === ext.extensionId)
        )
      )
    ).to.equal(true);
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});

const createSfdxProjectJsonWithAllFields = async (testSetup: TestSetup): Promise<void> => {
  const sfdxConfig = [
    '{',
    '\t"packageDirectories": [',
    '\t\t{',
    '\t\t\t"path": "force-app",',
    '\t\t\t"default": true',
    '\t\t}',
    '\t],',
    '\t"namespace": "",',
    '\t"sourceApiVersion": "61.0",',
    '\t"sourceBehaviorOptions": ["decomposeCustomLabelsBeta", "decomposePermissionSetBeta", "decomposeWorkflowBeta", "decomposeSharingRulesBeta"]',
    '}'
  ].join('\n');

  const sfdxProjectPath = path.join(testSetup.projectFolderPath!, 'sfdx-project.json');
  createOrOverwriteFile(sfdxProjectPath, sfdxConfig);
  await pause();
};
