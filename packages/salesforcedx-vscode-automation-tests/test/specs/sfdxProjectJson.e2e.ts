/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  openFile,
  pause,
  TestReqConfig,
  ProjectShapeOption
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import {
  getExtensionsToVerifyActive,
  reloadAndEnableExtensions,
  verifyExtensionsAreRunning
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testing';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import { getTextEditor, getWorkbench } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import { step } from 'mocha-steps';
import * as path from 'node:path';
import { after } from 'vscode-extension-tester';

describe('Customize sfdx-project.json', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NEW
    },
    isOrgRequired: false,
    testSuiteSuffixName: 'sfdxProjectJson'
  };

  before('Set up the testing environment', async () => {
    testSetup = await TestSetup.setUp(testReqConfig);
    await createSfdxProjectJsonWithAllFields(testSetup);
    await reloadAndEnableExtensions();
  });

  step('Verify our extensions are loaded after updating sfdx-project.json', async () => {
    expect(await verifyExtensionsAreRunning(getExtensionsToVerifyActive())).to.equal(true);
  });

  after('Tear down and clean up the testing environment', async () => {
    await testSetup?.tearDown();
  });
});

async function createSfdxProjectJsonWithAllFields(testSetup: TestSetup): Promise<void> {
  const workbench = getWorkbench();
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
  await openFile(path.join(testSetup.projectFolderPath!, 'sfdx-project.json'));
  const textEditor = await getTextEditor(workbench, 'sfdx-project.json');
  await textEditor.setText(sfdxConfig);
  await textEditor.save();
  await pause();
}
