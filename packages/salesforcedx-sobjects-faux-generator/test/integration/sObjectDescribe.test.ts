/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Org } from '@salesforce/core';
import { CommandOutput } from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { fail } from 'assert';
import { expect } from 'chai';
import { XHRResponse } from 'request-light';
import { SinonStub, stub } from 'sinon';
import { ConfigUtil } from '../../src/describe/configUtil';
import {
  ForceListSObjectSchemaExecutor,
  SObjectCategory,
  SObjectDescribe
} from '../../src/describe/sObjectDescribe';
import { mockDescribeResponse } from './mockData';

const sobjectdescribe = new SObjectDescribe();

// tslint:disable:no-unused-expression
describe('Fetch sObjects', () => {
  let getUsername: SinonStub;
  let connection: SinonStub;
  let xhrMock: SinonStub;
  let authInfo: SinonStub;
  let refreshAuth: SinonStub;

  beforeEach(() => {
    authInfo = stub(AuthInfo, 'create');
    authInfo.returns({
      getConnectionOptions: () => ({
        accessToken: '00Dxx000thisIsATestToken',
        instanceUrl: 'https://na1.salesforce.com'
      })
    });
    getUsername = stub(ConfigUtil, 'getUsername').returns('test@example.com');
    connection = stub(Org.prototype, 'getConnection');
    connection.returns({
      accessToken: '00Dxx000thisIsATestToken',
      instanceUrl: 'https://na1.salesforce.com'
    });
    refreshAuth = stub(Org.prototype, 'refreshAuth');
    xhrMock = stub(SObjectDescribe.prototype, 'runRequest');
  });

  afterEach(() => {
    getUsername.restore();
    connection.restore();
    xhrMock.restore();
    authInfo.restore();
    refreshAuth.restore();
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

  it('Should ensure valid session token', async () => {
    refreshAuth.callsFake(() => {
      connection.returns({
        accessToken: 'another-test-token',
        instanceUrl: 'https://na1.salesforce.com'
      });
    });
    await sobjectdescribe.getConnectionData('test/project/uri');
    const opts = sobjectdescribe.buildXHROptions(['test'], 0);
    expect(opts.headers.Authorization).to.equal('OAuth another-test-token');
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

  it('Should create the correct xhr options', async () => {
    const sobjectTypes = ['object1', 'object2', 'object3'];
    const testBatchReq = {
      batchRequests: [
        { method: 'GET', url: 'v46.0/sobjects/object1/describe' },
        { method: 'GET', url: 'v46.0/sobjects/object2/describe' },
        { method: 'GET', url: 'v46.0/sobjects/object3/describe' }
      ]
    };
    await sobjectdescribe.getConnectionData('test/project/uri');
    const xhrOptions = sobjectdescribe.buildXHROptions(sobjectTypes, 0);
    expect(xhrOptions).to.not.be.empty;
    expect(xhrOptions.type).to.be.equal('POST');
    expect(xhrOptions.url).to.be.equal(
      'https://na1.salesforce.com/services/data/v46.0/composite/batch'
    );
    expect(xhrOptions.headers).to.deep.equal({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'OAuth 00Dxx000thisIsATestToken',
      'User-Agent': 'salesforcedx-extension',
      'Sforce-Call-Options': 'client=sfdx-vscode'
    });
    expect(xhrOptions.data).to.be.equal(JSON.stringify(testBatchReq));
  });

  it('Should return sobjects when calling describeSObjectBatch', async () => {
    const sobjectTypes = ['ApexPageInfo'];
    xhrMock.returns(
      Promise.resolve({
        status: 200,
        responseText: JSON.stringify(mockDescribeResponse)
      } as XHRResponse)
    );

    const batchResponse = await sobjectdescribe.describeSObjectBatch(
      'test/project/uri',
      sobjectTypes,
      0
    );

    expect(xhrMock.calledOnce).to.equal(true);
    expect(batchResponse).to.be.an('array');
    expect(batchResponse.length).to.be.equal(1);
    expect(batchResponse[0]).to.deep.equal(
      mockDescribeResponse.results[0].result
    );
  });

  it('Should throw error when response errors out', async () => {
    const sobjectTypes = ['ApexPageInfo'];
    xhrMock.returns(
      Promise.reject({
        status: 400,
        responseText: 'Unexpected error'
      } as XHRResponse)
    );

    try {
      await sobjectdescribe.describeSObjectBatch(
        'test/project/uri',
        sobjectTypes,
        0
      );
      fail('An error was expected');
    } catch (err) {
      expect(err).to.be.equal('Unexpected error');
    }

    expect(xhrMock.calledOnce).to.equal(true);
  });

  it('Should throw error when authentication errors out', async () => {
    const sobjectdescribeException = new SObjectDescribe();
    const sobjectTypes = ['ApexPageInfo'];
    authInfo.throws(new Error('Unexpected error in Auth phase'));

    try {
      await sobjectdescribeException.describeSObjectBatch(
        'test/project/uri',
        sobjectTypes,
        0
      );
      fail('An error was expected');
    } catch (err) {
      expect(err).to.be.equal('Unexpected error in Auth phase');
    }

    expect(authInfo.calledOnce).to.equal(true);
  });
});
