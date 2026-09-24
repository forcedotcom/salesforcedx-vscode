/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Mock as VitestMock } from 'vitest';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { GatedSpanExporter } from '../../../src/observability/gatedSpanExporter';
import { SpanTransformProcessor } from '../../../src/observability/spanTransformProcessor';
import { isProductionTelemetryExportEnabled } from '../../../src/observability/appInsights';

vi.mock('../../../src/observability/appInsights', () => ({
  isProductionTelemetryExportEnabled: vi.fn()
}));

const mockedIsProductionTelemetryExportEnabled = vi.mocked(isProductionTelemetryExportEnabled);

const makeFakeExporter = (): SpanExporter & { export: VitestMock; forceFlush: VitestMock; shutdown: VitestMock } => ({
  export: vi.fn((_spans: ReadableSpan[], callback: (result: ExportResult) => void) =>
    callback({ code: ExportResultCode.SUCCESS })
  ),
  forceFlush: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined)
});

const stampedSpan = (
  name: string,
  telemetryClassification: 'gov' | 'nonGov' | 'unknown',
  telemetryIgnore = false
): ReadableSpan => {
  const span = {
    name,
    attributes: telemetryIgnore ? { telemetryIgnore: true } : {},
    parentSpanContext: undefined,
    resource: { attributes: {} },
    setAttribute: vi.fn()
  } as unknown as Parameters<SpanTransformProcessor['onStart']>[0];
  new SpanTransformProcessor({
    exporter: makeFakeExporter(),
    getIdentitySnapshot: () => ({ telemetryClassification })
  }).onStart(span, {} as Parameters<SpanTransformProcessor['onStart']>[1]);
  return span as unknown as ReadableSpan;
};

describe('GatedSpanExporter', () => {
  beforeEach(() => mockedIsProductionTelemetryExportEnabled.mockReturnValue(true));

  it('does not construct the delegate when disabled', () => {
    mockedIsProductionTelemetryExportEnabled.mockReturnValue(false);
    const make = vi.fn(makeFakeExporter);
    const exporter = new GatedSpanExporter({ make });
    const callback = vi.fn();

    exporter.export([stampedSpan('allowed', 'nonGov')], callback);

    expect(callback).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
    expect(make).not.toHaveBeenCalled();
  });

  it('exports only valid nonGov spans from a mixed batch', () => {
    const delegate = makeFakeExporter();
    const make = vi.fn(() => delegate);
    const exporter = new GatedSpanExporter({ make });
    const callback = vi.fn();

    exporter.export(
      [
        stampedSpan('gov', 'gov'),
        stampedSpan('unknown', 'unknown'),
        stampedSpan('ignored', 'nonGov', true),
        stampedSpan('allowed', 'nonGov')
      ],
      callback
    );

    expect(make).toHaveBeenCalledTimes(1);
    expect(delegate.export.mock.calls[0][0].map((span: ReadableSpan) => span.name)).toEqual(['allowed']);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it.each(['gov', 'unknown'] as const)('does not construct the delegate for %s spans', classification => {
    const make = vi.fn(makeFakeExporter);
    const exporter = new GatedSpanExporter({ make });

    exporter.export([stampedSpan(classification, classification)], vi.fn());

    expect(make).not.toHaveBeenCalled();
  });

  it('bypasses governance for local diversion', () => {
    const delegate = makeFakeExporter();
    const exporter = new GatedSpanExporter({
      make: () => delegate,
      bypassGovernance: true
    });

    exporter.export([stampedSpan('gov', 'gov'), stampedSpan('unknown', 'unknown')], vi.fn());

    expect(delegate.export.mock.calls[0][0]).toHaveLength(2);
  });

  it('re-checks enablement and reuses the delegate', () => {
    const delegate = makeFakeExporter();
    const make = vi.fn(() => delegate);
    const exporter = new GatedSpanExporter({ make, o11yEndpoint: 'http://localhost:4318' });
    const span = stampedSpan('allowed', 'nonGov');

    exporter.export([span], vi.fn());
    mockedIsProductionTelemetryExportEnabled.mockReturnValue(false);
    exporter.export([span], vi.fn());

    expect(mockedIsProductionTelemetryExportEnabled).toHaveBeenCalledWith('http://localhost:4318');
    expect(make).toHaveBeenCalledTimes(1);
    expect(delegate.export).toHaveBeenCalledTimes(1);
  });

  it('flushes and shuts down only an initialized delegate', async () => {
    const delegate = makeFakeExporter();
    const make = vi.fn(() => delegate);
    const exporter = new GatedSpanExporter({ make });

    await exporter.forceFlush();
    expect(make).not.toHaveBeenCalled();
    exporter.export([stampedSpan('allowed', 'nonGov')], vi.fn());
    await exporter.forceFlush();
    await exporter.shutdown();

    expect(delegate.forceFlush).toHaveBeenCalledTimes(1);
    expect(delegate.shutdown).toHaveBeenCalledTimes(1);
  });
});
