/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { workspace } from 'vscode';
import { GatedSpanExporter } from '../../../src/observability/gatedSpanExporter';

// isTelemetryExtensionConfigurationEnabled reads config.get; spy so tests are independent of the
// default mock (resetMocks clears the shared spy between tests, so set it explicitly each time).
const spyTelemetry = (enabled: boolean): void => {
  jest.spyOn(workspace, 'getConfiguration').mockReturnValue({
    get: () => enabled
  } as unknown as ReturnType<typeof workspace.getConfiguration>);
};
const disableTelemetry = (): void => spyTelemetry(false);
const enableTelemetry = (): void => spyTelemetry(true);

const spans = [{ name: 'span' } as unknown as ReadableSpan];

const makeFakeExporter = (): SpanExporter & { export: jest.Mock; shutdown: jest.Mock } => ({
  export: jest.fn((_spans: ReadableSpan[], cb: (r: ExportResult) => void) => cb({ code: ExportResultCode.SUCCESS })),
  shutdown: jest.fn().mockResolvedValue(undefined)
});

describe('GatedSpanExporter', () => {
  it('disabled: returns SUCCESS and NEVER constructs the delegate (no Statsbeat/network setup)', () => {
    disableTelemetry();
    const make = jest.fn(makeFakeExporter);
    const exporter = new GatedSpanExporter(make);

    const cb = jest.fn();
    exporter.export(spans, cb);

    expect(cb).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
    // the assertion the injected-fake-sender fixture could not make: delegate ctor never runs
    expect(make).not.toHaveBeenCalled();
  });

  it('enabled: constructs the delegate once, caches it, and forwards spans on each export', () => {
    enableTelemetry();
    const fake = makeFakeExporter();
    const make = jest.fn(() => fake);
    const exporter = new GatedSpanExporter(make);

    exporter.export(spans, jest.fn());
    exporter.export(spans, jest.fn());

    expect(make).toHaveBeenCalledTimes(1);
    expect(fake.export).toHaveBeenCalledTimes(2);
    expect(fake.export.mock.calls[0][0]).toBe(spans);
  });

  it('localhost o11yEndpoint bypasses a disabled setting: constructs delegate and forwards', () => {
    disableTelemetry();
    const fake = makeFakeExporter();
    const make = jest.fn(() => fake);
    const exporter = new GatedSpanExporter(make, 'http://localhost:4318');

    exporter.export(spans, jest.fn());

    expect(make).toHaveBeenCalledTimes(1);
    expect(fake.export).toHaveBeenCalledTimes(1);
  });

  it('shutdown before any export resolves without constructing the delegate', async () => {
    const make = jest.fn(makeFakeExporter);
    const exporter = new GatedSpanExporter(make);

    await expect(exporter.shutdown()).resolves.toBeUndefined();
    expect(make).not.toHaveBeenCalled();
  });

  it('shutdown after an enabled export delegates to the constructed exporter', async () => {
    enableTelemetry();
    const fake = makeFakeExporter();
    const exporter = new GatedSpanExporter(() => fake);

    exporter.export(spans, jest.fn());
    await exporter.shutdown();

    expect(fake.shutdown).toHaveBeenCalledTimes(1);
  });
});
