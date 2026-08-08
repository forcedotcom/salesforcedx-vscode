/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApplicationInsightsWebExporter } from '../../../src/observability/applicationInsightsWebExporter';
import { ExportResultCode } from '@opentelemetry/core';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

const span = {
  name: 'web-span',
  kind: SpanKind.INTERNAL,
  parentSpanContext: undefined,
  spanContext: () => ({ traceId: 'trace', spanId: 'span' }),
  startTime: [1, 0],
  endTime: [2, 0],
  duration: [1, 0],
  status: { code: SpanStatusCode.OK },
  attributes: {},
  resource: { attributes: { 'extension.name': 'test', 'extension.version': '1' } }
} as unknown as ReadableSpan;

describe('ApplicationInsightsWebExporter', () => {
  it('does not construct or dispose a reporter before a valid send', async () => {
    const reporter = { dispose: jest.fn().mockResolvedValue(undefined) };
    const makeReporter = jest.fn(() => reporter);
    const exporter = new ApplicationInsightsWebExporter(makeReporter as never);

    expect(makeReporter).not.toHaveBeenCalled();
    await exporter.shutdown();
    expect(makeReporter).not.toHaveBeenCalled();
    expect(reporter.dispose).not.toHaveBeenCalled();
  });

  it('constructs on the first valid send and disposes the initialized reporter', async () => {
    const reporter = {
      sendDangerousTelemetryEvent: jest.fn(),
      sendDangerousTelemetryErrorEvent: jest.fn(),
      dispose: jest.fn().mockResolvedValue(undefined)
    };
    const exporter = new ApplicationInsightsWebExporter(jest.fn(() => reporter) as never);
    await new Promise<void>(resolve =>
      exporter.export([span], result => {
        expect(result.code).toBe(ExportResultCode.SUCCESS);
        resolve();
      })
    );

    expect(reporter.sendDangerousTelemetryEvent).toHaveBeenCalledTimes(1);
    await exporter.shutdown();
    expect(reporter.dispose).toHaveBeenCalledTimes(1);
  });
});
