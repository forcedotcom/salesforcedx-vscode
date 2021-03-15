/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { fail } from 'assert';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { SObjectDescribe } from '../../src/describe';
import { SObjectCategory, SObjectRefreshSource } from '../../src/types';
import { mockDescribeResponse } from './mockData';

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
  let connection: Connection;
  let sobjectdescribe: SObjectDescribe;
  let describeGlobalStub: any;

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
    describeGlobalStub = env.stub(connection, 'describeGlobal');
  });

  afterEach(() => env.restore());

  it('Should throw exception when describeGlobal fails', async () => {
    describeGlobalStub.throws(
      new Error('Unexpected error when running describeGlobal')
    );
    try {
      await sobjectdescribe.describeGlobal(
        SObjectCategory.ALL,
        SObjectRefreshSource.Manual
      );
      fail('test should have failed with an api exception');
    } catch (e) {
      expect(e.message).contains(
        'Unexpected error when running describeGlobal'
      );
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

    const results = await sobjectdescribe.describeGlobal(
      SObjectCategory.ALL,
      SObjectRefreshSource.Manual
    );
    expect(results.length).to.eql(4);
    expect(results).to.deep.equal([
      'MyCustomObj1',
      'MyCustomObj2',
      'Account',
      'Contact'
    ]);
  });

  it('Should return only custom sobjects when running describeGlobal', async () => {
    describeGlobalStub.resolves({
      sobjects: [
        { custom: true, name: 'MyCustomObj1' },
        { custom: true, name: 'MyCustomObj2' },
        { custom: false, name: 'Account' },
        { custom: false, name: 'Contact' }
      ]
    });

    const results = await sobjectdescribe.describeGlobal(
      SObjectCategory.CUSTOM,
      SObjectRefreshSource.Manual
    );
    expect(results.length).to.eql(2);
    expect(results).to.deep.equal(['MyCustomObj1', 'MyCustomObj2']);
  });

  it('Should return only standard sobjects when running describeGlobal', async () => {
    describeGlobalStub.resolves({
      sobjects: [
        { custom: true, name: 'MyCustomObj1' },
        { custom: true, name: 'MyCustomObj2' },
        { custom: false, name: 'Account' },
        { custom: false, name: 'Contact' },
        { custom: false, name: 'Lead' }
      ]
    });

    const results = await sobjectdescribe.describeGlobal(
      SObjectCategory.STANDARD,
      SObjectRefreshSource.Manual
    );
    expect(results.length).to.eql(3);
    expect(results).to.deep.equal(['Account', 'Contact', 'Lead']);
  });

  it('Should filter out sobjects if category is CUSTOM when running describeGlobal', async () => {
    describeGlobalStub.resolves(SOBJECTS_DESCRIBE_SAMPLE);

    const results = await sobjectdescribe.describeGlobal(
      SObjectCategory.CUSTOM,
      SObjectRefreshSource.Manual
    );
    expect(results.length).to.eql(3);
    expect(results).to.deep.equal([
      'MyCustomObj1',
      'MyCustomObj2',
      'Custom_History_Obj'
    ]);
  });

  it('Should filter out sobjects if category is STANDARD when running describeGlobal', async () => {
    describeGlobalStub.resolves(SOBJECTS_DESCRIBE_SAMPLE);

    const results = await sobjectdescribe.describeGlobal(
      SObjectCategory.STANDARD,
      SObjectRefreshSource.Manual
    );
    expect(results.length).to.eql(4);
    expect(results).to.deep.equal(['Account', 'Contact', 'Lead', 'Event']);
  });

  it('Should filter out sobjects if category is ALL & source is Startup when running describeGlobal', async () => {
    describeGlobalStub.resolves(SOBJECTS_DESCRIBE_SAMPLE);

    const results = await sobjectdescribe.describeGlobal(
      SObjectCategory.ALL,
      SObjectRefreshSource.Startup
    );
    expect(results.length).to.eql(7);
    expect(results).to.deep.equal([
      'MyCustomObj1',
      'MyCustomObj2',
      'Custom_History_Obj',
      'Account',
      'Contact',
      'Lead',
      'Event'
    ]);
  });

  it('Should filter out sobjects if category is ALL & source is StartupMin when running describeGlobal', async () => {
    describeGlobalStub.resolves(SOBJECTS_DESCRIBE_SAMPLE);

    const results = await sobjectdescribe.describeGlobal(
      SObjectCategory.ALL,
      SObjectRefreshSource.Startup
    );
    expect(results.length).to.eql(7);
    expect(results).to.deep.equal([
      'MyCustomObj1',
      'MyCustomObj2',
      'Custom_History_Obj',
      'Account',
      'Contact',
      'Lead',
      'Event'
    ]);
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
    const requestBody = sobjectdescribe.buildBatchRequestBody(sobjectTypes);
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
    const requestStub = env.stub(connection, 'request');
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
    env.stub(connection, 'request').resolves(mockDescribeResponse);

    const batchResponse = await sobjectdescribe.describeSObjectBatchRequest(
      sobjectTypes
    );

    expect(batchResponse.length).to.be.equal(1);
    expect(batchResponse[0]).to.deep.equal(
      mockDescribeResponse.results[0].result
    );
  });

  it('Should handle describe call returning no sobjects when calling describeSObjectBatch', async () => {
    const sobjectTypes = ['ApexPageInfo'];
    env.stub(connection, 'request').resolves({
      results: undefined
    });

    const batchResponse = await sobjectdescribe.describeSObjectBatchRequest(
      sobjectTypes
    );

    expect(batchResponse.length).to.be.equal(0);
  });

  it('Should handle empty describe calls responses when calling describeSObjectBatch', async () => {
    const sobjectTypes = ['ApexPageInfo'];
    env.stub(connection, 'request').resolves({});

    const batchResponse = await sobjectdescribe.describeSObjectBatchRequest(
      sobjectTypes
    );

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
