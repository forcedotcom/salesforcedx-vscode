/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { ConnectionService } from '../../../src/core/connectionService';
import { QueryService } from '../../../src/core/queryService';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it('uses the Connection API version in the Salesforce query URL', async () => {
  const urls: string[] = [];
  globalThis.fetch = jest.fn(async input => {
    urls.push(String(input));
    return new Response(JSON.stringify({ totalSize: 1, done: true, records: [{ Id: '001' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  });
  const connection = {
    instanceUrl: 'https://example.my.salesforce.com',
    accessToken: 'token',
    getApiVersion: () => '66.0',
    refreshAuth: jest.fn(async () => {})
  } as unknown as Connection;
  const connectionLayer = Layer.succeed(ConnectionService, {
    getConnection: () => Effect.succeed(connection),
    getConnectionForOrg: () => Effect.succeed(connection)
  } as unknown as InstanceType<typeof ConnectionService>);
  const layer = QueryService.DefaultWithoutDependencies.pipe(Layer.provide(connectionLayer));

  const records = await Effect.runPromise(
    Effect.gen(function* () {
      const queryService = yield* QueryService;
      const result = yield* queryService.query(
        { soql: 'SELECT Id FROM Account' },
        Schema.Struct({ Id: Schema.String })
      );
      return Array.from(yield* Stream.runCollect(result.records));
    }).pipe(Effect.provide(layer))
  );

  expect(records).toEqual([{ Id: '001' }]);
  expect(urls).toEqual(['https://example.my.salesforce.com/services/data/v66.0/query?q=SELECT%20Id%20FROM%20Account']);
});
