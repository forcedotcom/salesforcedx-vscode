/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import * as utils from '../../src/tests/utils';

let mockConnection: Connection;
const testData = new MockTestOrgData();
const queryPage = (records: unknown[]) => ({ done: true, totalSize: records.length, records });

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
    const queryStub = $$.SANDBOX.stub(mockConnection, 'query')
      //@ts-ignore
      .resolves(queryPage([{ NamespacePrefix: 'myNamespace' }]));
    await utils.queryNamespaces(mockConnection);
    expect(queryStub.calledTwice).toBe(true);
  });

  it('should output set of namespaces from both queries', async () => {
    const queryStub = $$.SANDBOX.stub(mockConnection, 'query');
    queryStub
      .onFirstCall()
      //@ts-ignore
      .resolves(queryPage([{ NamespacePrefix: 'myNamespace' }, { NamespacePrefix: 'otherNamespace' }]));
    //@ts-ignore
    queryStub.onSecondCall().resolves(queryPage([{ NamespacePrefix: 'otherNamespace' }]));

    const namespaces = await utils.queryNamespaces(mockConnection);
    expect(queryStub.calledTwice).toBe(true);
    expect(namespaces).toEqual([
      { installedNs: false, namespace: 'otherNamespace' },
      { installedNs: true, namespace: 'myNamespace' },
      { installedNs: true, namespace: 'otherNamespace' }
    ]);
  });

  it.each([
    ['REST', false],
    ['Tooling', true]
  ] as const)('follows queryMore for %s queries', async (_name, tooling) => {
    const queryConnection = tooling ? mockConnection.tooling : mockConnection;
    const queryStub = $$.SANDBOX.stub(queryConnection, 'query').resolves({
      done: false,
      totalSize: 2,
      records: [{ Id: '001000000000001' }],
      nextRecordsUrl: '/next'
    });
    const queryMoreStub = $$.SANDBOX.stub(queryConnection, 'queryMore').resolves({
      done: true,
      totalSize: 2,
      records: [{ Id: '001000000000002' }]
    });

    const result = await utils.queryAll(mockConnection, 'SELECT Id FROM Account', tooling);

    expect(result.records).toEqual([{ Id: '001000000000001' }, { Id: '001000000000002' }]);
    expect(queryStub.calledOnce).toBe(true);
    expect(queryMoreStub.calledOnceWith('/next')).toBe(true);
  });
});
