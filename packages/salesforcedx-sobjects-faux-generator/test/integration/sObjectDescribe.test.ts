/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core-bundle';
import { fail } from 'assert';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { SObjectDescribe } from '../../src/describe';
import { mockAPIResponse, mockMinimizedResponseResult } from './mockData';

const CONNECTION_DATA = {
  accessToken: '00Dxx000thisIsATestToken',
  instanceUrl: 'https://na1.salesforce.com'
};

const SOBJECTS_DESCRIBE_SAMPLE = {
  sobjects: [
    { custom: true, name: 'MyCustomObj1' },
    { custom: true, name: 'MyCustomObj2' },
    { custom: true, name: 'Custom_History_Obj' },
    { custom: true, name: 'MyCustomObj1Share' },
    { custom: true, name: 'MyCustomObj2History' },
    { custom: true, name: 'MyCustomObj1Feed' },
    { custom: true, name: 'MyCustomObj2Event' },
    { custom: false, name: 'Account' },
    { custom: false, name: 'Contact' },
    { custom: false, name: 'Lead' },
    { custom: false, name: 'Event' }
  ]
};
const env = createSandbox();

// tslint:disable:no-unused-expression
describe('Fetch sObjects', () => {
  const USERNAME = 'test@example.com';
  let connection: Connection;
  let sobjectdescribe: SObjectDescribe;
  let describeGlobalStub: any;

  beforeEach(async () => {
    env.stub(AuthInfo, 'create').resolves({
      getConnectionOptions: () => CONNECTION_DATA,
      getUsername: () => USERNAME
    });
    connection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: USERNAME
      })
    });
    sobjectdescribe = new SObjectDescribe(connection);
    describeGlobalStub = env.stub(connection, 'describeGlobal');
  });

  afterEach(() => env.restore());

  it('Should throw exception when describeGlobal fails', async () => {
    describeGlobalStub.throws(new Error('Unexpected error when running describeGlobal'));
    try {
      await sobjectdescribe.describeGlobal();
      fail('test should have failed with an api exception');
    } catch (e) {
      expect(e.message).contains('Unexpected error when running describeGlobal');
    }
  });

  it('Should return all sobjects when running describeGlobal', async () => {
    describeGlobalStub.resolves({
      sobjects: [
        { custom: true, name: 'MyCustomObj1' },
        { custom: true, name: 'MyCustomObj2' },
        { custom: false, name: 'Account' },
        { custom: false, name: 'Contact' }
      ]
    });

    const results = await sobjectdescribe.describeGlobal();
    expect(results.length).to.eql(4);
    expect(results).to.deep.equal([
      { custom: true, name: 'MyCustomObj1' },
      { custom: true, name: 'MyCustomObj2' },
      { custom: false, name: 'Account' },
      { custom: false, name: 'Contact' }
    ]);
  });

  it('Should build the sobject describe url', () => {
    expect(sobjectdescribe.buildSObjectDescribeURL('testObject')).to.equal('v50.0/sobjects/testObject/describe');
  });

  it('Should build the batch request url', async () => {
    expect(sobjectdescribe.buildBatchRequestURL()).to.equal(
      'https://na1.salesforce.com/services/data/v50.0/composite/batch'
    );
  });

  it('Should build the api version', () => {
    expect(sobjectdescribe.getVersion()).to.equal('v50.0');
  });

  it('Should create batch request body', () => {
    const sobjectTypes = ['object1', 'object2', 'object3'];
    const testBatchReq = {
      batchRequests: [
        { method: 'GET', url: 'v50.0/sobjects/object1/describe' },
        { method: 'GET', url: 'v50.0/sobjects/object2/describe' },
        { method: 'GET', url: 'v50.0/sobjects/object3/describe' }
      ]
    };
    const requestBody = sobjectdescribe.buildBatchRequestBody(sobjectTypes);
    expect(requestBody).to.deep.equals(testBatchReq);
  });

  it('Should create the correct request options', async () => {
    const testBatchReq = {
      batchRequests: [
        { method: 'GET', url: 'v50.0/sobjects/object1/describe' },
        { method: 'GET', url: 'v50.0/sobjects/object2/describe' },
        { method: 'GET', url: 'v50.0/sobjects/object3/describe' }
      ]
    };
    const requestStub = env.stub(connection, 'request');
    await sobjectdescribe.runRequest(testBatchReq);
    expect(requestStub.firstCall.args[0]).to.deep.equal({
      method: 'POST',
      url: `${connection.instanceUrl}/services/data/v50.0/composite/batch`,
      body: JSON.stringify(testBatchReq),
      headers: {
        'User-Agent': 'salesforcedx-extension',
        'Sforce-Call-Options': 'client=sfdx-vscode'
      }
    });
  });

  it('Should return sobjects when calling describeSObjectBatch', async () => {
    const sobjectTypes = ['ApexPageInfo'];
    env.stub(connection, 'request').resolves(mockAPIResponse);

    const batchResponse = await sobjectdescribe.describeSObjectBatchRequest(sobjectTypes);

    expect(batchResponse.length).to.be.equal(1);
    expect(batchResponse[0]).to.deep.equal(mockMinimizedResponseResult);
  });

  it('Should handle describe call returning no sobjects when calling describeSObjectBatch', async () => {
    const sobjectTypes = ['ApexPageInfo'];
    env.stub(connection, 'request').resolves({
      results: undefined
    });

    const batchResponse = await sobjectdescribe.describeSObjectBatchRequest(sobjectTypes);

    expect(batchResponse.length).to.be.equal(0);
  });

  it('Should handle empty describe calls responses when calling describeSObjectBatch', async () => {
    const sobjectTypes = ['ApexPageInfo'];
    env.stub(connection, 'request').resolves({});

    const batchResponse = await sobjectdescribe.describeSObjectBatchRequest(sobjectTypes);

    expect(batchResponse.length).to.be.equal(0);
  });

  it('Should throw error when response errors out', async () => {
    const sobjectTypes = ['ApexPageInfo'];
    env.stub(connection, 'request').rejects({
      status: 400,
      body: 'Unexpected error'
    });

    try {
      await sobjectdescribe.describeSObjectBatchRequest(sobjectTypes);
      fail('An error was expected');
    } catch (err) {
      expect(err).to.be.equal('Unexpected error');
    }
  });
});
