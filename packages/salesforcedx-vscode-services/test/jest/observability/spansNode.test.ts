/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { ExportResultCode } from '@opentelemetry/core';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { DEFAULT_AI_CONNECTION_STRING } from '../../../src/observability/appInsights';
import type { LocalEnvelopeSender } from '../../../src/observability/localEnvelopeSender';
import { FilteredAzureMonitorTraceExporter } from '../../../src/observability/spansNode';

// Top-level span (parentSpanContext undefined) with no telemetryIgnore so it survives
// isSpanValidForProductionTelemetry; resource attribute makes createResourceMetricEnvelope non-undefined.
const makeSpan = (): ReadableSpan =>
  ({
    name: 'test-span',
    kind: SpanKind.INTERNAL,
    parentSpanContext: undefined,
    spanContext: () => ({ traceId: '0af7651916cd43dd8448eb211c80319c', spanId: 'b7ad6b7169203331', traceFlags: 1 }),
    startTime: [1_700_000_000, 0] as [number, number],
    endTime: [1_700_000_001, 0] as [number, number],
    duration: [1, 0] as [number, number],
    status: { code: SpanStatusCode.OK },
    attributes: {},
    links: [],
    events: [],
    resource: { attributes: { 'extension.name': 'x' } },
    instrumentationScope: { name: 'test-scope' }
  }) as unknown as ReadableSpan;

const makeFakeSender = (): LocalEnvelopeSender & { exportEnvelopes: jest.Mock } => ({
  exportEnvelopes: jest.fn().mockResolvedValue({ code: ExportResultCode.SUCCESS }),
  shutdown: () => Promise.resolve()
});

const isResourceMetricEnvelope = (e: unknown): boolean =>
  (e as { data?: { baseData?: { metrics?: { name?: string }[] } } }).data?.baseData?.metrics?.[0]?.name ===
  '_OTELRESOURCE_';

describe('FilteredAzureMonitorTraceExporter', () => {
  it('suppresses the _OTELRESOURCE_ resource metric while still exporting span envelopes', async () => {
    const exporter = new FilteredAzureMonitorTraceExporter({ connectionString: DEFAULT_AI_CONNECTION_STRING });
    const sender = makeFakeSender();
    (exporter as unknown as { sender: LocalEnvelopeSender }).sender = sender;

    const callback = jest.fn();
    await exporter.export([makeSpan()], callback);

    expect(sender.exportEnvelopes).toHaveBeenCalledTimes(1);
    const envelopes = sender.exportEnvelopes.mock.calls[0][0] as unknown[];
    expect(envelopes.some(isResourceMetricEnvelope)).toBe(false);
    // guards against a suppression that just dropped everything
    expect(envelopes.length).toBeGreaterThanOrEqual(1);
  });

  // Control: the unmodified SDK emits _OTELRESOURCE_ for the same span. Pins the fix to real
  // SDK behavior — if the SDK stops emitting the metric or renames the field, this fails loudly.
  it('control: unmodified AzureMonitorTraceExporter emits the _OTELRESOURCE_ metric', async () => {
    const exporter = new AzureMonitorTraceExporter({ connectionString: DEFAULT_AI_CONNECTION_STRING });
    const sender = makeFakeSender();
    (exporter as unknown as { sender: LocalEnvelopeSender }).sender = sender;

    const callback = jest.fn();
    await exporter.export([makeSpan()], callback);

    expect(sender.exportEnvelopes).toHaveBeenCalledTimes(1);
    const envelopes = sender.exportEnvelopes.mock.calls[0][0] as unknown[];
    expect(envelopes.some(isResourceMetricEnvelope)).toBe(true);
  });

  it('shutdown resolves', async () => {
    const exporter = new FilteredAzureMonitorTraceExporter({ connectionString: DEFAULT_AI_CONNECTION_STRING });
    (exporter as unknown as { sender: LocalEnvelopeSender }).sender = makeFakeSender();
    await expect(exporter.shutdown()).resolves.toBeUndefined();
  });
});
