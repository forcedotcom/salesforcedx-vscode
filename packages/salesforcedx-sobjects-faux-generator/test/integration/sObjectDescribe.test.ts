/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// import rimraf = require('rimraf');
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import * as sinon from 'sinon';
// import * as path from 'path';
import {
  ForceListSObjectSchemaExecutor,
  SObjectCategory,
  SObjectDescribe
} from '../../src/describe/sObjectDescribe';
// import * as util from './integrationTestUtil';
const sobjectdescribe = new SObjectDescribe();
// The CustomObjects are all identical in terms of fields, just different ones to test batch
// and multiple objects for testing describeGlobal
/* const PROJECT_NAME = `project_${new Date().getTime()}`;
const CUSTOM_OBJECT_NAME = 'MyCustomObject__c';
const CUSTOM_OBJECT2_NAME = 'MyCustomObject2__c';
const CUSTOM_OBJECT3_NAME = 'MyCustomObject3__c';
const CUSTOM_FIELDNAME = 'MyCustomField__c';
const SIMPLE_OBJECT_SOURCE_FOLDER = 'simpleObjectAndField';

const sobjectdescribe = new SObjectDescribe();
const MIN_CUSTOMOBJECT_NUM_FIELDS = 9;
const CUSTOMOBJECT_NUMBERFIELD_PRECISION = 18;
*/

// tslint:disable:no-unused-expression
describe('Fetch sObjects', () => {
  it('Should build the schema sobject list command', async () => {
    const sobjectType = 'all';
    const username = 'user@example.com';
    const schemaSObjectList = new ForceListSObjectSchemaExecutor();
    const schemaSObjectListCommand = schemaSObjectList.build(
      sobjectType,
      username
    );

    expect(schemaSObjectListCommand.toCommand()).to.equal(
      `sfdx force:schema:sobject:list --sobjecttypecategory ${sobjectType} --json --loglevel fatal --targetusername ${username}`
    );
  });

  it('Should return sobjects when running describeGlobal', async () => {
    const responseData = {
      status: 0,
      result: ['MyCustomObject2__c', 'MyCustomObject3__c', 'MyCustomObject__c']
    };
    const cmdOutputStub = sinon
      .stub(CommandOutput.prototype, 'getCmdResult')
      .returns(JSON.stringify(responseData));
    const execStub = sinon.stub(
      ForceListSObjectSchemaExecutor.prototype,
      'execute'
    );
    const result = await sobjectdescribe.describeGlobal(
      process.cwd(),
      SObjectCategory.CUSTOM,
      'user@example.com'
    );
    expect(result).to.deep.equal(responseData.result);
    cmdOutputStub.restore();
    execStub.restore();
  });

  /* this.timeout(180000);
  let username: string;

  before(async () => {
    const customFields: util.CustomFieldInfo[] = [
      new util.CustomFieldInfo(CUSTOM_OBJECT_NAME, [
        `${CUSTOM_OBJECT_NAME}.${CUSTOM_FIELDNAME}`
      ]),
      new util.CustomFieldInfo(CUSTOM_OBJECT2_NAME, [
        `${CUSTOM_OBJECT2_NAME}.${CUSTOM_FIELDNAME}`
      ]),
      new util.CustomFieldInfo(CUSTOM_OBJECT3_NAME, [
        `${CUSTOM_OBJECT3_NAME}.${CUSTOM_FIELDNAME}`
      ])
    ];

    username = await util.initializeProject(
      PROJECT_NAME,
      SIMPLE_OBJECT_SOURCE_FOLDER,
      customFields
    );
  });

  after(async () => {
    if (username) {
      await util.deleteScratchOrg(username);
    }
    const projectPath = path.join(process.cwd(), PROJECT_NAME);
    rimraf.sync(projectPath);
  });

  it('Should be able to call describeGlobal', async () => {
    const objs = [CUSTOM_OBJECT_NAME, CUSTOM_OBJECT2_NAME, CUSTOM_OBJECT3_NAME];
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

  it('Should be able to call describeSObject on custom object', async () => {
    const cmdOutput = await sobjectdescribe.describeSObject(
      process.cwd(),
      CUSTOM_OBJECT_NAME,
      username
    );
    expect(cmdOutput.name).to.be.equal(CUSTOM_OBJECT_NAME);
    expect(cmdOutput.custom).to.be.true;
    expect(cmdOutput.fields.length).to.be.least(MIN_CUSTOMOBJECT_NUM_FIELDS);
    const customField = cmdOutput.fields[cmdOutput.fields.length - 1];
    expect(customField.custom).to.be.true;
    expect(customField.precision).to.be.equal(
      CUSTOMOBJECT_NUMBERFIELD_PRECISION
    );
    expect(customField.scale).to.be.equal(0);
    expect(customField.name).to.be.equal('MyCustomField__c');
  });

  it('Should be able to call describeSObjectBatch on custom objects', async () => {
    const cmdOutput = await sobjectdescribe.describeSObjectBatch(
      process.cwd(),
      [CUSTOM_OBJECT_NAME, CUSTOM_OBJECT2_NAME, CUSTOM_OBJECT3_NAME],
      0,
      username
    );
    expect(cmdOutput[0].name).to.be.equal(CUSTOM_OBJECT_NAME);
    expect(cmdOutput[0].custom).to.be.true;
    expect(cmdOutput[0].fields.length).to.be.least(MIN_CUSTOMOBJECT_NUM_FIELDS);
    const customField = cmdOutput[0].fields[cmdOutput[0].fields.length - 1];
    expect(customField.name).to.be.equal('MyCustomField__c');

    expect(cmdOutput[1].name).to.be.equal(CUSTOM_OBJECT2_NAME);
    expect(cmdOutput[1].custom).to.be.true;
    expect(cmdOutput[1].fields.length).to.be.least(MIN_CUSTOMOBJECT_NUM_FIELDS);

    expect(cmdOutput[2].name).to.be.equal(CUSTOM_OBJECT3_NAME);
  });

  it('Should be able to call describeSObject on standard object', async () => {
    // const cmdOutput = await sobjectdescribe.describeSObject(
    //   process.cwd(),
    //   'Account',
    //   username
    // );
    // expect(cmdOutput.name).to.be.equal('Account');
    // expect(cmdOutput.custom).to.be.false;
    // expect(cmdOutput.fields.length).to.be.least(59);
  }); */
});
