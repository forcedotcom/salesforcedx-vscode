/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { type ExportResult, ExportResultCode } from '@opentelemetry/core';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { OtlpFileSpanExporterWeb } from '../../../src/observability/otlpFileSpanExporterWeb';

const span = {
  name: 'local-span',
  kind: SpanKind.INTERNAL,
  parentSpanContext: undefined,
  spanContext: () => ({ traceId: 'trace', spanId: 'span' }),
  startTime: [1, 0],
  endTime: [2, 0],
  duration: [1, 0],
  status: { code: SpanStatusCode.OK },
  attributes: {},
  links: [],
  events: [],
  resource: { attributes: { 'extension.name': 'test', 'extension.version': '1' } },
  instrumentationScope: { name: 'test-scope' }
} as unknown as ReadableSpan;

describe('OtlpFileSpanExporterWeb', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts spans with an absolute native fetch URL', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const exporter = new OtlpFileSpanExporterWeb();
    const result = await new Promise<ExportResult>(resolve => exporter.export([span], resolve));

    expect(result.code).toBe(ExportResultCode.SUCCESS);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3003/otlp-spans',
      expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } })
    );
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)).lines).toHaveLength(1);
    await exporter.shutdown();
  });
});
