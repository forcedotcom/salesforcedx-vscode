/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { fail } from 'assert';
import { expect } from 'chai';
import { connect } from 'http2';
import { createSandbox, SinonStub, stub } from 'sinon';
import {
  ForceListSObjectSchemaExecutor,
  SObjectCategory,
  SObjectDescribe
} from '../../src/describe/sObjectDescribe';
import { mockDescribeResponse } from './mockData';

const CONNECTION_DATA = {
  accessToken: '00Dxx000thisIsATestToken',
  instanceUrl: 'https://na1.salesforce.com'
};

const env = createSandbox();

// tslint:disable:no-unused-expression
describe('Fetch sObjects', () => {
  let connection: Connection;
  let sobjectdescribe: SObjectDescribe;

  beforeEach(async () => {
    env.stub(AuthInfo, 'create').returns({
      getConnectionOptions: () => CONNECTION_DATA
    });
    connection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: 'test@example.com'
      })
    });
    sobjectdescribe = new SObjectDescribe(connection);
  });

  afterEach(() => env.restore());

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

  it('Should create the correct request options', async () => {
    const testBatchReq = {
      batchRequests: [
        { method: 'GET', url: 'v46.0/sobjects/object1/describe' },
        { method: 'GET', url: 'v46.0/sobjects/object2/describe' },
        { method: 'GET', url: 'v46.0/sobjects/object3/describe' }
      ]
    };
    const requestStub = env.stub(connection, 'requestRaw');
    await sobjectdescribe.runRequest(testBatchReq);
    expect(requestStub.firstCall.args[0]).to.deep.equal({
      method: 'POST',
      url: `${connection.instanceUrl}/services/data/v46.0/composite/batch`,
      body: JSON.stringify(testBatchReq),
      headers: {
        'User-Agent': 'salesforcedx-extension',
        'Sforce-Call-Options': `client=sfdx-vscode`
      }
    });
  });

  it('Should return sobjects when calling describeSObjectBatch', async () => {
    const sobjectTypes = ['ApexPageInfo'];
    env.stub(connection, 'requestRaw').resolves({
      status: 200,
      body: JSON.stringify(mockDescribeResponse)
    });

    const batchResponse = await sobjectdescribe.describeSObjectBatch(
      sobjectTypes,
      0
    );

    expect(batchResponse.length).to.be.equal(1);
    expect(batchResponse[0]).to.deep.equal(
      mockDescribeResponse.results[0].result
    );
  });

  it('Should throw error when response errors out', async () => {
    const sobjectTypes = ['ApexPageInfo'];
    env.stub(connection, 'requestRaw').returns(
      Promise.reject({
        status: 400,
        body: 'Unexpected error'
      })
    );

    try {
      await sobjectdescribe.describeSObjectBatch(sobjectTypes, 0);
      fail('An error was expected');
    } catch (err) {
      expect(err).to.be.equal('Unexpected error');
    }
  });

  // it('Should throw error when authentication errors out', async () => {
  //   const sobjectTypes = ['ApexPageInfo'];
  //   authInfo.throws(new Error('Unexpected error in Auth phase'));

  //   try {
  //     await sobjectdescribe.describeSObjectBatch(sobjectTypes, 0);
  //     fail('An error was expected');
  //   } catch (err) {
  //     expect(err).to.be.equal('Unexpected error in Auth phase');
  //   }
  //   expect(authInfo.called).to.equal(true);
  // });
});
