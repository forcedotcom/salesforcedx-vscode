/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { setImmediate } from 'node:timers/promises';
import { DEFAULT_AI_CONNECTION_STRING } from '../../../src/observability/appInsights';
import { ApplicationInsightsNodeExporter } from '../../../src/observability/applicationInsightsNodeExporter';

const { send } = vi.hoisted(() => ({ send: vi.fn<() => Promise<ExportResult>>() }));
vi.mock('../../../src/observability/localEnvelopeSender', () => ({
  makeLocalEnvelopeSender: () => ({ exportEnvelopes: send, shutdown: () => Promise.resolve() })
}));

it('flushes custom-event transport after the native log emitter has already accepted the span', async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<ExportResult>();
  send.mockImplementation(() => {
    started.resolve();
    return release.promise;
  });
  const exporter = new ApplicationInsightsNodeExporter(DEFAULT_AI_CONNECTION_STRING, 'http://localhost:3003');
  const provider = new NodeTracerProvider();
  const span = provider.getTracer('custom-events').startSpan('custom-event');
  span.end();
  const emitted = Promise.withResolvers<ExportResult>();
  exporter.export([span as unknown as ReadableSpan], emitted.resolve);
  await started.promise;
  expect(await emitted.promise).toEqual({ code: ExportResultCode.SUCCESS });
  let flushed = false;
  const flushing = exporter.forceFlush().then(() => {
    flushed = true;
  });
  try {
    await setImmediate();
    expect(flushed).toBe(false);
    release.resolve({ code: ExportResultCode.SUCCESS });
    await flushing;
    expect(flushed).toBe(true);
  } finally {
    release.resolve({ code: ExportResultCode.SUCCESS });
    await exporter.shutdown();
    await provider.shutdown();
  }
});
