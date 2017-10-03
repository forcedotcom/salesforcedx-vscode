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

// The CustomObjects are all identical in terms of fields, just different ones to test batch
// and multiple objects for testing describeGlobal
const PROJECT_NAME = `project_${new Date().getTime()}`;
const CUSTOM_OBJECT_NAME = 'MyCustomObject__c';
const CUSTOM_OBJECT2 = 'MyCustomObject2__c';
const CUSTOM_OBJECT3 = 'MyCustomObject3__c';
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
  this.timeout(180000);
  let username: string;

  before(async function() {
    await util.createSFDXProject(PROJECT_NAME);
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
    const projectPath = path.join(process.cwd(), PROJECT_NAME);
    rimraf.sync(projectPath);
  });

  it('Should be able to call describeGlobal', async function() {
    const objs = [CUSTOM_OBJECT_NAME, CUSTOM_OBJECT2, CUSTOM_OBJECT3];
    const cmdOutput = await sobjectdescribe.describeGlobal(
      process.cwd(),
      SObjectCategory.CUSTOM,
      username
    );
    expect(cmdOutput.length).to.be.equal(3);
    expect(cmdOutput[0]).to.be.oneOf(objs);
    expect(cmdOutput[1]).to.be.oneOf(objs);
    expect(cmdOutput[2]).to.be.oneOf(objs);
    expect(cmdOutput[0]).to.not.equal(cmdOutput[1]);
    expect(cmdOutput[0]).to.not.equal(cmdOutput[2]);
    expect(cmdOutput[1]).to.not.equal(cmdOutput[2]);
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

  it('Should be able to call describeSObjectBatch on custom objects', async function() {
    const cmdOutput = await sobjectdescribe.describeSObjectBatch(
      process.cwd(),
      [CUSTOM_OBJECT_NAME, CUSTOM_OBJECT2, CUSTOM_OBJECT3],
      0,
      username
    );
    expect(cmdOutput[0].name).to.be.equal(CUSTOM_OBJECT_NAME);
    expect(cmdOutput[0].custom).to.be.true;
    expect(cmdOutput[0].fields.length).to.be.least(9);
    const customField = cmdOutput[0].fields[cmdOutput[0].fields.length - 1];
    expect(customField.name).to.be.equal('MyCustomField__c');

    expect(cmdOutput[1].name).to.be.equal(CUSTOM_OBJECT2);
    expect(cmdOutput[1].custom).to.be.true;
    expect(cmdOutput[1].fields.length).to.be.least(9);

    expect(cmdOutput[2].name).to.be.equal(CUSTOM_OBJECT3);
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
