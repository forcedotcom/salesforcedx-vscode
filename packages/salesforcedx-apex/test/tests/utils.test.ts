/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import * as utils from '../../src/tests/utils';
import { getBufferSize, getJsonIndent, resetLimitsForTesting } from '../../src/tests/utils';

let mockConnection: Connection;
const testData = new MockTestOrgData();

describe('Query Namespaces', () => {
  const $$ = new TestContext();

  beforeEach(async () => {
    await $$.stubAuths(testData);
    // Stub retrieveMaxApiVersion to get over "Domain Not Found: The org cannot be found" error
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    $$.SANDBOX.stub(mockConnection, 'instanceUrl').get(() => 'https://na139.salesforce.com');
  });

  it('should query for installed packages and namespaced orgs', async () => {
    const queryStub = $$.SANDBOX.stub().resolves({
      totalSize: 1,
      records: [{ NamespacePrefix: 'myNamespace' }]
    });
    $$.fakeConnectionRequest = (request, options) => queryStub(request, options);
    await utils.queryNamespaces(mockConnection);
    expect(queryStub.calledTwice).toBe(true);
  });

  it('should output set of namespaces from both queries', async () => {
    const queryStub = $$.SANDBOX.stub();
    queryStub.onFirstCall().resolves({
      totalSize: 2,
      records: [{ NamespacePrefix: 'myNamespace' }, { NamespacePrefix: 'otherNamespace' }]
    });
    queryStub.onSecondCall().resolves({
      totalSize: 1,
      records: [{ NamespacePrefix: 'otherNamespace' }]
    });
    $$.fakeConnectionRequest = (request, options) => queryStub(request, options);

    const namespaces = await utils.queryNamespaces(mockConnection);
    expect(queryStub.calledTwice).toBe(true);
    expect(namespaces).toEqual([
      { installedNs: false, namespace: 'otherNamespace' },
      { installedNs: true, namespace: 'myNamespace' },
      { installedNs: true, namespace: 'otherNamespace' }
    ]);
  });
});

describe('getJsonIndent', () => {
  beforeEach(() => {
    resetLimitsForTesting();
  });
  it('should return the integer value of the environment variable when it is set and is an integer', () => {
    process.env.SF_APEX_RESULTS_JSON_INDENT = '4';
    const result = getJsonIndent();
    expect(result).toBe(4);
  });

  it('should return undefined when the environment variable is not set or is not an integer', () => {
    process.env.SF_APEX_RESULTS_JSON_INDENT = 'not an integer';
    const result = getJsonIndent();
    expect(result).toBeUndefined();
  });
});

describe('getBufferSize', () => {
  beforeEach(() => {
    resetLimitsForTesting();
  });
  it('should return the integer value of the environment variable when it is set and is an integer', () => {
    process.env.SF_APEX_JSON_BUFFER_SIZE = '512';
    const result = getBufferSize();
    expect(result).toBe(512);
  });

  it('should return 256 when the environment variable is not set or is not an integer', () => {
    process.env.SF_APEX_JSON_BUFFER_SIZE = 'not an integer';
    const result = getBufferSize();
    expect(result).toBe(256);
  });
});
