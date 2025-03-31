/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { step } from 'mocha-steps';
import path from 'path';
import { after } from 'vscode-extension-tester';
import { TestSetup } from 'salesforcedx-vscode-automation-tests-redhat/test/testSetup';
import * as utilities from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';

// In future we will merge the test together with deployAndRetrieve
describe('metadata mdDeployRetrieve', async () => {
  let testSetup: TestSetup;
  const testReqConfig: utilities.TestReqConfig = {
    projectConfig: {
      projectShape: utilities.ProjectShapeOption.NAMED,
      githubRepoUrl: 'https://github.com/mingxuanzhangsfdx/DeployInv.git'
    },
    isOrgRequired: true,
    testSuiteSuffixName: 'mdDeployRetrieve'
  };
  let mdPath: string;
  let textV1: string;
  let textV2: string;
  let textV2AfterRetrieve: string;

  step('Set up the testing environment', async () => {
    utilities.log(`mdDeployRetrieve - Set up the testing environment`);
    testSetup = await TestSetup.setUp(testReqConfig);
    mdPath = path.join(
      testSetup.projectFolderPath!,
      'force-app/main/default/objects/Account/fields/Deploy_Test__c.field-meta.xml'
    );
  });

  step('Open and deploy MD v1', async () => {
    utilities.log(`mdDeployRetrieve - Open and deploy MD v1`);
    await utilities.openFile(mdPath);
    textV1 = await utilities.attemptToFindTextEditorText(mdPath);
    await utilities.runAndValidateCommand('Deploy', 'to', 'ST', 'CustomField', 'Account.Deploy_Test__c');
    await utilities.clearOutputView();
    await utilities.closeAllEditors(); // close editor to make sure editor is up to date
  });

  step('Update MD v2 and deploy again', async () => {
    utilities.log(`mdDeployRetrieve - Update MD v2 and deploy again`);
    await utilities.gitCheckout('updated-md', testSetup.projectFolderPath);
    await utilities.openFile(mdPath);
    textV2 = await utilities.attemptToFindTextEditorText(mdPath);
    expect(textV1).not.to.equal(textV2); // MD file should be updated
    await utilities.runAndValidateCommand('Deploy', 'to', 'ST', 'CustomField', 'Account.Deploy_Test__c');
    await utilities.clearOutputView();
  });

  step('Retrieve MD v2 and verify the text not changed', async () => {
    utilities.log(`mdDeployRetrieve - Retrieve MD v2 and verify the text not changed`);
    await utilities.openFile(mdPath);
    await utilities.runAndValidateCommand('Retrieve', 'from', 'ST', 'CustomField', 'Account.Deploy_Test__c');
    textV2AfterRetrieve = await utilities.attemptToFindTextEditorText(mdPath);

    expect(textV2AfterRetrieve).to.contain(textV2); // should be same
  });

  after('Tear down and clean up the testing environment', async () => {
    utilities.log(`mdDeployRetrieve - Tear down and clean up the testing environment`);
    await utilities.gitCheckout('main', testSetup.projectFolderPath);
    await testSetup?.tearDown();
  });
});
