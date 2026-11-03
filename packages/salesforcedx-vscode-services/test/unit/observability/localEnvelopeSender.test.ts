/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResultCode } from '@opentelemetry/core';
import { makeLocalEnvelopeSender } from '../../../src/observability/localEnvelopeSender';

// FetchHttpClient's Context.Reference captures one fetch function; keep its identity stable across cases.
const fetch = vi.fn<typeof globalThis.fetch>();
beforeEach(() => vi.stubGlobal('fetch', fetch));
afterEach(() => vi.unstubAllGlobals());

it('posts newline-delimited Breeze envelopes through the V4 Fetch client', async () => {
  fetch.mockResolvedValue(new Response('', { status: 200 }));
  const sender = makeLocalEnvelopeSender('http://localhost:3003/');
  try {
    expect(await sender.exportEnvelopes([{ name: 'first' }, { name: 'second' }])).toEqual({
      code: ExportResultCode.SUCCESS
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe('http://localhost:3003/v2.1/track');
    expect(init?.method).toBe('POST');
    expect(await new Response(init?.body).text()).toBe('{"name":"first"}\n{"name":"second"}');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/x-json-stream');
  } finally {
    await sender.shutdown();
  }
});

it('preserves an unsuccessful HTTP status as a failed export result', async () => {
  fetch.mockResolvedValue(new Response('', { status: 503 }));
  const sender = makeLocalEnvelopeSender('http://localhost:3003');
  try {
    const result = await sender.exportEnvelopes([]);
    expect(result.code).toBe(ExportResultCode.FAILED);
    expect(result.error?.message).toBe('local /v2.1/track responded 503');
  } finally {
    await sender.shutdown();
  }
});

it('reports V4 transport failures without rejecting the export promise', async () => {
  const cause = new Error('offline');
  fetch.mockRejectedValue(cause);
  const sender = makeLocalEnvelopeSender('http://localhost:3003');
  try {
    const result = await sender.exportEnvelopes([{ name: 'event' }]);
    expect(result.code).toBe(ExportResultCode.FAILED);
    expect(result.error).toMatchObject({ _tag: 'HttpClientError', reason: { cause } });
  } finally {
    await sender.shutdown();
  }
});

it('preserves serialization failure causes and does not start a request', async () => {
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  const sender = makeLocalEnvelopeSender('http://localhost:3003');
  try {
    const result = await sender.exportEnvelopes([cyclic]);
    expect(result.code).toBe(ExportResultCode.FAILED);
    expect(result.error).toMatchObject({
      _tag: 'EnvelopeSerializationError',
      message: 'Failed to serialize local Breeze envelopes'
    });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await sender.shutdown();
  }
});
