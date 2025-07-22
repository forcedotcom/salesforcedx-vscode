/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  log,
  openFile,
  TestReqConfig,
  ProjectShapeOption
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core';
import { runAndValidateCommand } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/salesforce-components';
import { gitCheckout } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/system-operations';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';
import {
  attemptToFindTextEditorText,
  clearOutputView,
  closeAllEditors
} from '@salesforce/salesforcedx-vscode-test-tools/lib/src/ui-interaction';
import { expect } from 'chai';
import * as path from 'node:path';
import { after } from 'vscode-extension-tester';

// In future we will merge the test together with deployAndRetrieve
describe('metadata mdDeployRetrieve', () => {
  let testSetup: TestSetup;
  const testReqConfig: TestReqConfig = {
    projectConfig: {
      projectShape: ProjectShapeOption.NAMED,
      githubRepoUrl: 'https://github.com/mingxuanzhangsfdx/DeployInv.git'
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'mdDeployRetrieve'
  };
  let mdPath: string;
  let textV1: string;
  let textV2: string;
  let textV2AfterRetrieve: string;

  before('Set up the testing environment', async () => {
    log('mdDeployRetrieve - Set up the testing environment');
    testSetup = await TestSetup.setUp(testReqConfig);
    mdPath = path.join(
      testSetup.projectFolderPath!,
      'force-app/main/default/objects/Account/fields/Deploy_Test__c.field-meta.xml'
    );
  });

  beforeEach(function () {
    if (this.currentTest?.parent?.tests.some(test => test.state === 'failed')) {
      this.skip();
    }
  });

  it('Open and deploy MD v1', async () => {
    log('mdDeployRetrieve - Open and deploy MD v1');
    await openFile(mdPath);
    textV1 = await attemptToFindTextEditorText(mdPath);
    await runAndValidateCommand('Deploy', 'to', 'ST', 'CustomField', 'Account.Deploy_Test__c');
    await clearOutputView();
    await closeAllEditors(); // close editor to make sure editor is up to date
  });

  it('Update MD v2 and deploy again', async () => {
    log('mdDeployRetrieve - Update MD v2 and deploy again');
    await gitCheckout('updated-md', testSetup.projectFolderPath);
    await openFile(mdPath);
    textV2 = await attemptToFindTextEditorText(mdPath);
    expect(textV1).not.to.equal(textV2); // MD file should be updated
    await runAndValidateCommand('Deploy', 'to', 'ST', 'CustomField', 'Account.Deploy_Test__c');
    await clearOutputView();
  });

  it('Retrieve MD v2 and verify the text not changed', async () => {
    log('mdDeployRetrieve - Retrieve MD v2 and verify the text not changed');
    await openFile(mdPath);
    await runAndValidateCommand('Retrieve', 'from', 'ST', 'CustomField', 'Account.Deploy_Test__c');
    textV2AfterRetrieve = await attemptToFindTextEditorText(mdPath);

    expect(textV2AfterRetrieve).to.contain(textV2); // should be same
  });

  after('Tear down and clean up the testing environment', async () => {
    log('mdDeployRetrieve - Tear down and clean up the testing environment');
    await gitCheckout('main', testSetup.projectFolderPath);
    await testSetup?.tearDown();
  });
});
