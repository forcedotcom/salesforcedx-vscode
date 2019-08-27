/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo } from '@salesforce/core';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import { ConfigUtil } from '../../src/describe/configUtil';
import {
  ForceListSObjectSchemaExecutor,
  SObjectCategory,
  SObjectDescribe
} from '../../src/describe/sObjectDescribe';

const sobjectdescribe = new SObjectDescribe();

// tslint:disable:no-unused-expression
describe('Fetch sObjects', () => {
  let getUsername: SinonStub;
  let authInfo: SinonStub;

  beforeEach(() => {
    getUsername = stub(ConfigUtil, 'getUsername').returns('test@example.com');
    authInfo = stub(AuthInfo, 'create').returns({
      getConnectionOptions() {
        return {
          accessToken: '00Dxx000thisIsATestToken',
          instanceUrl: 'https://na1.salesforce.com'
        };
      }
    });
  });

  afterEach(() => {
    getUsername.restore();
    authInfo.restore();
  });

  it('Should build the schema sobject list command', async () => {
    const sobjectType = 'all';
    const schemaSObjectList = new ForceListSObjectSchemaExecutor();
    const schemaSObjectListCommand = schemaSObjectList.build(sobjectType);

    expect(schemaSObjectListCommand.toCommand()).to.equal(
      `sfdx force:schema:sobject:list --sobjecttypecategory ${sobjectType} --json --loglevel fatal`
    );
  });

  it('Should return sobjects when running describeGlobal', async () => {
    const responseData = {
      status: 0,
      result: ['MyCustomObject2__c', 'MyCustomObject3__c', 'MyCustomObject__c']
    };
    const cmdOutputStub = stub(CommandOutput.prototype, 'getCmdResult').returns(
      JSON.stringify(responseData)
    );
    const execStub = stub(ForceListSObjectSchemaExecutor.prototype, 'execute');
    const result = await sobjectdescribe.describeGlobal(
      process.cwd(),
      SObjectCategory.CUSTOM
    );
    expect(result).to.deep.equal(responseData.result);
    cmdOutputStub.restore();
    execStub.restore();
  });

  it('Should build the sobject describe url', () => {
    expect(sobjectdescribe.buildSObjectDescribeURL('testObject')).to.equal(
      'v46.0/sobjects/testObject/describe'
    );
  });

  it('Should build the batch request url', async () => {
    await sobjectdescribe.getConnectionData('test/project/uri');
    expect(sobjectdescribe.buildBatchRequestURL()).to.equal(
      'https://na1.salesforce.com/services/data/v46.0/composite/batch'
    );
  });

  it('Should build the api version', () => {
    expect(sobjectdescribe.getVersion()).to.equal('v46.0');
  });

  it('Should create batch request body', () => {
    const sobjectTypes = ['object1', 'object2', 'object3'];
    const testBatchReq = {
      batchRequests: [
        { method: 'GET', url: 'v46.0/sobjects/object1/describe' },
        { method: 'GET', url: 'v46.0/sobjects/object2/describe' },
        { method: 'GET', url: 'v46.0/sobjects/object3/describe' }
      ]
    };
    const requestBody = sobjectdescribe.buildBatchRequestBody(sobjectTypes, 0);
    expect(requestBody).to.deep.equals(testBatchReq);
  });

  /* it('Should return sobjects when calling describeSObjectBatch', async () => {
    const sobjectTypes = ['object1', 'object2', 'object3'];

    const batchResponse = await sobjectdescribe.describeSObjectBatch(
      'test/project/uri',
      sobjectTypes,
      0
    );
    expect(1, requests.length);
    requests[0].respond(
      200,
      { 'Content-Type': 'application/json' },
      '[{ "id": 12, "comment": "Hey there" }]'
    );
    console.log('batchResponse ==>', batchResponse);
    expect(batchResponse).to.deep.equals('');
  }); */
});
