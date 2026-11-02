/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import * as Effect from 'effect/Effect';
import { buildAsyncPayload, buildSyncPayload } from '../../src/effect';

describe('Effect payload namespace recovery', () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  let connection: Connection;

  beforeEach(async () => {
    await $$.stubAuths(testData);
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    connection = await Connection.create({ authInfo: await AuthInfo.create({ username: testData.username }) });
  });

  it.each(['sync', 'async'] as const)(
    'uses InstalledSubscriberPackage when PackageLicense is inaccessible (%#)',
    async mode => {
      const query = $$.SANDBOX.stub(connection, 'query');
      query.withArgs('SELECT NamespacePrefix FROM Organization').resolves({ done: true, totalSize: 0, records: [] });
      query.withArgs('SELECT NamespacePrefix FROM PackageLicense').rejects(new Error('No PackageLicense access'));
      const toolingQuery = $$.SANDBOX.stub(connection.tooling, 'query').resolves({
        done: true,
        totalSize: 1,
        records: [{ SubscriberPackage: { NamespacePrefix: 'installedPkg' } }]
      });

      const options = {
        testLevel: 'RunSpecifiedTests' as const,
        tests: 'installedPkg.MyTest,installedPkg.MyTest',
        skipCodeCoverage: true
      };
      const payload =
        mode === 'sync'
          ? await Effect.runPromise(buildSyncPayload(connection, options))
          : await Effect.runPromise(buildAsyncPayload(connection, options));

      expect(payload).toEqual({
        tests: [{ className: 'installedPkg.MyTest' }, { className: 'installedPkg.MyTest' }],
        testLevel: 'RunSpecifiedTests',
        skipCodeCoverage: true
      });
      expect(query.callCount).toBe(2);
      expect(toolingQuery.args).toEqual([['SELECT SubscriberPackage.NamespacePrefix FROM InstalledSubscriberPackage']]);
    }
  );

  it('classifies Apex and Flow selections with installed namespaces even when Organization is inaccessible', async () => {
    const query = $$.SANDBOX.stub(connection, 'query');
    query.withArgs('SELECT NamespacePrefix FROM Organization').rejects(new Error('No Organization access'));
    query.withArgs('SELECT NamespacePrefix FROM PackageLicense').resolves({
      done: true,
      totalSize: 1,
      records: [{ NamespacePrefix: 'installedPkg' }]
    });

    const payload = await Effect.runPromise(
      buildAsyncPayload(connection, {
        testLevel: 'RunSpecifiedTests',
        tests: 'installedPkg.MyTest,FlowTesting.installedPkg.MyFlow'
      })
    );

    expect(payload).toMatchObject({
      tests: [{ className: 'installedPkg.MyTest' }, { className: 'FlowTesting.installedPkg.MyFlow' }]
    });
  });

  it('keeps the org Flow namespace when installed namespace lookups both fail', async () => {
    const query = $$.SANDBOX.stub(connection, 'query');
    query.withArgs('SELECT NamespacePrefix FROM Organization').resolves({
      done: true,
      totalSize: 1,
      records: [{ NamespacePrefix: 'orgNs' }]
    });
    query.withArgs('SELECT NamespacePrefix FROM PackageLicense').rejects(new Error('No PackageLicense access'));
    $$.SANDBOX.stub(connection.tooling, 'query').rejects(new Error('No InstalledSubscriberPackage access'));

    const payload = await Effect.runPromise(
      buildSyncPayload(connection, { testLevel: 'RunSpecifiedTests', tests: 'FlowTesting.orgNs.MyFlow' })
    );

    expect(payload).toMatchObject({
      tests: [{ namespace: 'FlowTesting.orgNs', className: 'FlowTesting.orgNs.MyFlow' }]
    });
  });

  it('groups Apex and Flow methods when all namespace lookups fail', async () => {
    $$.SANDBOX.stub(connection, 'query').rejects(new Error('No namespace query access'));
    $$.SANDBOX.stub(connection.tooling, 'query').rejects(new Error('No installed package access'));

    const payload = await Effect.runPromise(
      buildAsyncPayload(connection, {
        testLevel: 'RunSpecifiedTests',
        tests: 'MyTest.first,FlowTesting.MyFlow.first,MyTest.second,FlowTesting.MyFlow.second'
      })
    );

    expect(payload).toMatchObject({
      tests: [
        { className: 'MyTest', testMethods: ['first', 'second'] },
        { className: 'FlowTesting.MyFlow', testMethods: ['first', 'second'] }
      ]
    });
  });
});
