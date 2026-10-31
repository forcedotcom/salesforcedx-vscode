/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { MockTestOrgData, TestContext } from '@salesforce/core/testSetup';
import * as Effect from 'effect/Effect';
import { retrieveAllSuites } from '../../src/effect';

describe('Effect suite discovery', () => {
  const $$ = new TestContext();
  const testData = new MockTestOrgData();
  let connection: Connection;

  beforeEach(async () => {
    await $$.stubAuths(testData);
    $$.SANDBOX.stub(Connection.prototype, 'retrieveMaxApiVersion').resolves('50.0');
    connection = await Connection.create({ authInfo: await AuthInfo.create({ username: testData.username }) });
  });

  it.each([
    { id: '0M1000000000001', TestSuiteName: 'MySuite' },
    { Id: '0M1000000000001', TestSuiteName: 'MySuite' }
  ])('normalizes suite ids from $id $Id', async record => {
    $$.SANDBOX.stub(connection.tooling, 'query').resolves({ done: true, totalSize: 1, records: [record] });

    expect(await Effect.runPromise(retrieveAllSuites(connection))).toEqual([
      { id: '0M1000000000001', TestSuiteName: 'MySuite' }
    ]);
  });

  it('rejects a suite record without an id', async () => {
    $$.SANDBOX.stub(connection.tooling, 'query').resolves({
      done: true,
      totalSize: 1,
      records: [{ TestSuiteName: 'MySuite' }]
    });

    expect(await Effect.runPromise(retrieveAllSuites(connection).pipe(Effect.flip))).toMatchObject({
      _tag: 'ApexResponseDecodeError',
      operation: 'retrieveAllSuites',
      message: 'Invalid query response'
    });
  });
});
