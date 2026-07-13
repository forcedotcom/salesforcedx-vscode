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

const makeConn = (requestImpl: jest.Mock): Connection =>
  ({ version: '60.0', request: requestImpl }) as unknown as Connection;

/** Layer that hands the fetch service a fake connection through the services-extension API. */
const provideConn = (conn: Connection) =>
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: { ConnectionService: { getConnection: () => Effect.succeed(conn) } }
    } as unknown as SalesforceVSCodeServicesApi)
  });

// The fake's getConnection is R=never at runtime, but api's ConnectionService type re-adds the
// requirement to the channel; cast it away since provideConn fully satisfies it at runtime.
const run = (request: jest.Mock, log: string) =>
  fetchHeapDumpOverlayResults(log).pipe(Effect.provide(provideConn(makeConn(request)))) as Effect.Effect<
    HeapDumpResult[],
    unknown,
    never
  >;

const okSubResponse = (id: string) => ({ statusCode: 200, result: { Id: id } });

describe('fetchHeapDumpOverlayResults', () => {
  it('returns empty array when the log has no heap dumps', async () => {
    const request = jest.fn();
    const results = await Effect.runPromise(run(request, 'no dumps here'));
    expect(results).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });

  it('dedups repeated heap-dump ids into one subrequest', async () => {
    const request = jest.fn().mockResolvedValue({ hasErrors: false, results: [okSubResponse('id1')] });
    const log = [heapDumpLine('id1'), heapDumpLine('id1'), heapDumpLine('id1')].join('\n');

    const results = await Effect.runPromise(run(request, log));

    expect(request).toHaveBeenCalledTimes(1);
    const body = JSON.parse(request.mock.calls[0][0].body);
    expect(body.batchRequests).toHaveLength(1);
    expect(body.batchRequests[0].url).toBe('v60.0/tooling/sobjects/ApexExecutionOverlayResult/id1');
    expect(results).toEqual([{ heapDumpId: 'id1', success: { Id: 'id1' } }]);
  });

  it('chunks more than 25 ids into two batches', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `id${i}`);
    const request = jest.fn().mockImplementation((req: { body: string }) => {
      const body = JSON.parse(req.body) as { batchRequests: { url: string }[] };
      return Promise.resolve({
        hasErrors: false,
        results: body.batchRequests.map(sub => okSubResponse(sub.url.split('/').at(-1)!))
      });
    });
    const log = ids.map(heapDumpLine).join('\n');

    const results = await Effect.runPromise(run(request, log));

    expect(request).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(30);
    expect(new Set(results.map(r => r.heapDumpId))).toEqual(new Set(ids));
  });

  it('maps a per-id batch error body to an error result', async () => {
    const request = jest.fn().mockResolvedValue({
      hasErrors: true,
      results: [{ statusCode: 404, result: [{ errorCode: 'NOT_FOUND', message: 'missing' }] }]
    });
    const log = heapDumpLine('id1');

    const results = await Effect.runPromise(run(request, log));

    expect(results).toEqual([{ heapDumpId: 'id1', error: 'missing (NOT_FOUND)' }]);
  });

  it('fails with a tagged error when the request rejects', async () => {
    const request = jest.fn().mockRejectedValue(new Error('network down'));
    const log = heapDumpLine('id1');

    const exit = await Effect.runPromiseExit(run(request, log));

    expect(exit._tag).toBe('Failure');
  });
});
