/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { ExtensionProviderService, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import type { HeapDumpResult } from '@salesforce/salesforcedx-apex-replay-debugger';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { fetchHeapDumpOverlayResults } from '../../../src/services/heapDumpOverlayFetch';

const heapDumpLine = (id: string) => `<TimeInfo>|HEAP_DUMP|[11]|${id}|ClassName1|ns1|11`;

/**
 * A realistic overlay-result record: the tooling query returns the full HeapDump compound field.
 * (/composite/batch returns only the `attributes` stub with HeapDump dropped — the reason this
 * fetch uses a query.) A record whose HeapDump has no extents would leave replay variables empty,
 * so the tests assert the extents survive round-trip.
 */
const overlayRecord = (id: string) => ({
  attributes: { type: 'ApexExecutionOverlayResult', url: `/x/${id}` },
  Id: id,
  HeapDump: {
    className: 'ClassName1',
    namespace: 'ns1',
    extents: [{ typeName: 'ClassName1', extent: [{ address: '0x1', symbols: ['v'], value: { entry: [] } }] }]
  }
});

const makeConn = (queryImpl: jest.Mock): Connection =>
  ({ version: '60.0', tooling: { query: queryImpl } }) as unknown as Connection;

/** Layer that hands the fetch service a fake connection through the services-extension API. */
const provideConn = (conn: Connection) =>
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: { ConnectionService: { getConnection: () => Effect.succeed(conn) } }
    } as unknown as SalesforceVSCodeServicesApi)
  });

// The fake's getConnection is R=never at runtime, but api's ConnectionService type re-adds the
// requirement to the channel; cast it away since provideConn fully satisfies it at runtime.
const run = (query: jest.Mock, log: string) =>
  fetchHeapDumpOverlayResults(log).pipe(Effect.provide(provideConn(makeConn(query)))) as Effect.Effect<
    HeapDumpResult[],
    unknown,
    never
  >;

describe('fetchHeapDumpOverlayResults', () => {
  it('returns empty array when the log has no heap dumps', async () => {
    const query = jest.fn();
    const results = await Effect.runPromise(run(query, 'no dumps here'));
    expect(results).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('dedups repeated heap-dump ids into one query and preserves the HeapDump payload', async () => {
    const query = jest.fn().mockResolvedValue({ records: [overlayRecord('id1')] });
    const log = [heapDumpLine('id1'), heapDumpLine('id1'), heapDumpLine('id1')].join('\n');

    const results = await Effect.runPromise(run(query, log));

    expect(query).toHaveBeenCalledTimes(1);
    const soql = query.mock.calls[0][0] as string;
    expect(soql).toContain('HeapDump');
    expect(soql).toContain("WHERE Id IN ('id1')");
    expect(results).toHaveLength(1);
    expect(results[0].heapDumpId).toBe('id1');
    // Regression guard: the HeapDump extents must survive — an empty payload renders no variables.
    expect('success' in results[0] && results[0].success.HeapDump.extents).toHaveLength(1);
  });

  it('chunks more than 200 ids into two queries', async () => {
    const ids = Array.from({ length: 230 }, (_, i) => `id${i}`);
    const query = jest.fn().mockImplementation((soql: string) => {
      const inIds = soql.match(/'([^']+)'/g)!.map(quoted => quoted.slice(1, -1));
      return Promise.resolve({ records: inIds.map(overlayRecord) });
    });
    const log = ids.map(heapDumpLine).join('\n');

    const results = await Effect.runPromise(run(query, log));

    expect(query).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(230);
    expect(new Set(results.map(r => r.heapDumpId))).toEqual(new Set(ids));
  });

  it('maps an id with no returned record to an error result', async () => {
    const query = jest.fn().mockResolvedValue({ records: [] });
    const log = heapDumpLine('id1');

    const results = await Effect.runPromise(run(query, log));

    expect(results).toEqual([{ heapDumpId: 'id1', error: 'No overlay result found for id1' }]);
  });

  it('fails with a tagged error when the query rejects', async () => {
    const query = jest.fn().mockRejectedValue(new Error('network down'));
    const log = heapDumpLine('id1');

    const exit = await Effect.runPromiseExit(run(query, log));

    expect(exit._tag).toBe('Failure');
  });
});
