/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import rimraf = require('rimraf');
import { expect } from 'chai';
import * as path from 'path';
import {
  SObjectCategory,
  SObjectDescribe
} from '../../src/describe/sObjectDescribe';
import * as util from './integrationTestUtil';

const PROJECT_NAME = `project_${new Date().getTime()}`;
const keyLocation = path.join(process.cwd(), PROJECT_NAME, 'devhub.key');
const CUSTOM_OBJECT_NAME = 'MyCustomObject__c';
const CUSTOM_FIELD_FULLNAME = CUSTOM_OBJECT_NAME + '.MyCustomField__c';
const SIMPLE_OBJECT_DIR = path.join(
  'test',
  'integration',
  'config',
  'simpleObjectAndField',
  'objects'
);

const sobjectdescribe = new SObjectDescribe();

// tslint:disable:no-unused-expression
describe('Fetch sObjects', function() {
  // tslint:disable-next-line:no-invalid-this
  this.timeout(60000);
  let username: string;

  before(async function() {
    await util.createSFDXProject(PROJECT_NAME);
    console.log('process: ' + process.cwd());
    util.createCIKey(keyLocation);
    console.log('key: ' + keyLocation);
    username = await util.createScratchOrg(PROJECT_NAME);

    const sourceFolder = path.join(
      __dirname,
      '..',
      '..',
      '..',
      SIMPLE_OBJECT_DIR
    );
    await util.push(sourceFolder, PROJECT_NAME, username);

    const permSetName = 'AllowRead';
    const permissionSetId = await util.createPermissionSet(
      permSetName,
      username
    );

    await util.createFieldPermissions(
      permissionSetId,
      CUSTOM_OBJECT_NAME,
      CUSTOM_FIELD_FULLNAME,
      username
    );

    await util.assignPermissionSet(permSetName, username);
  });

  after(function() {
    util.deleteCIKey(keyLocation);
    const projectPath = path.join(process.cwd(), PROJECT_NAME);
    rimraf.sync(projectPath);
  });

  it('Should be able to call describeGlobal', async function() {
    const cmdOutput = await sobjectdescribe.describeGlobal(
      process.cwd(),
      SObjectCategory.CUSTOM,
      username
    );
    expect(cmdOutput.length).to.be.equal(1);
    expect(cmdOutput[0]).to.be.equal(CUSTOM_OBJECT_NAME);
  });

  it('Should be able to call describeSObject on custom object', async function() {
    const cmdOutput = await sobjectdescribe.describeSObject(
      process.cwd(),
      CUSTOM_OBJECT_NAME,
      username
    );
    expect(cmdOutput.name).to.be.equal(CUSTOM_OBJECT_NAME);
    expect(cmdOutput.custom).to.be.true;
    expect(cmdOutput.fields.length).to.be.least(9);
    const customField = cmdOutput.fields[cmdOutput.fields.length - 1];
    expect(customField.custom).to.be.true;
    expect(customField.precision).to.be.equal(18);
    expect(customField.scale).to.be.equal(0);
    expect(customField.name).to.be.equal('MyCustomField__c');
  });

  it('Should be able to call describeSObject on standard object', async function() {
    // const cmdOutput = await sobjectdescribe.describeSObject(
    //   process.cwd(),
    //   'Account',
    //   username
    // );
    // expect(cmdOutput.name).to.be.equal('Account');
    // expect(cmdOutput.custom).to.be.false;
    // expect(cmdOutput.fields.length).to.be.least(59);
  });
});
