/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExportResultCode } from '@opentelemetry/core';
import type { ReadableLogRecord } from '@opentelemetry/sdk-logs';
import { DEFAULT_AI_CONNECTION_STRING } from '../../../src/observability/appInsights';
import { AzureMonitorLogExporterWrapper } from '../../../src/observability/azureMonitorLogExporterWrapper';
import type { LocalEnvelopeSender } from '../../../src/observability/localEnvelopeSender';

// A customEvent LogRecord shaped like ApplicationInsightsNodeExporter emits (microsoft.custom_event.name
// routes to the EventData/customEvents table). logToEnvelope reads hrTime, resource.attributes, body and
// attributes, so all are populated to survive the real SDK envelope mapping.
const makeLogRecord = (): ReadableLogRecord =>
  ({
    hrTime: [1_700_000_000, 0] as [number, number],
    hrTimeObserved: [1_700_000_000, 0] as [number, number],
    severityNumber: 9,
    severityText: 'INFO',
    body: { measurements: { duration: 5 } },
    resource: { attributes: { 'extension.name': 'x', 'service.name': 'test-svc' } },
    instrumentationScope: { name: 'test-scope' },
    attributes: { 'microsoft.custom_event.name': 'test-event', foo: 'bar' },
    droppedAttributesCount: 0
  }) as unknown as ReadableLogRecord;

const makeFakeSender = (): LocalEnvelopeSender & { exportEnvelopes: jest.Mock } => ({
  exportEnvelopes: jest.fn().mockResolvedValue({ code: ExportResultCode.SUCCESS }),
  shutdown: () => Promise.resolve()
});

// Override the underlying AzureMonitorLogExporter's private `_sender` field so export() routes envelopes
// to the fake. If beta.43 renamed `_sender`, this write lands on a stray property, the SDK exports through
// its real HttpSender, and exportEnvelopes below is never called — the assertion fails loudly.
const injectLogSender = (wrapper: AzureMonitorLogExporterWrapper, sender: LocalEnvelopeSender): void => {
  (wrapper as unknown as { exporter: { _sender: LocalEnvelopeSender } }).exporter._sender = sender;
};

const baseType = (e: unknown): unknown => (e as { data?: { baseType?: unknown } }).data?.baseType;
const eventName = (e: unknown): unknown =>
  (e as { data?: { baseData?: { name?: unknown } } }).data?.baseData?.name;

describe('AzureMonitorLogExporterWrapper', () => {
  it('routes a LogRecord to the private _sender as an EventData Breeze envelope', async () => {
    const wrapper = new AzureMonitorLogExporterWrapper(
      { connectionString: DEFAULT_AI_CONNECTION_STRING },
      'http://localhost:3003'
    );
    const sender = makeFakeSender();
    injectLogSender(wrapper, sender);

    // export() delegates to the async inner exporter and invokes the callback after exportEnvelopes resolves.
    await new Promise<void>(resolve => wrapper.export([makeLogRecord()], () => resolve()));

    expect(sender.exportEnvelopes).toHaveBeenCalledTimes(1);
    const envelopes = sender.exportEnvelopes.mock.calls[0][0] as unknown[];
    expect(envelopes).toHaveLength(1);
    expect(baseType(envelopes[0])).toBe('EventData');
    expect(eventName(envelopes[0])).toBe('test-event');
  });
});
