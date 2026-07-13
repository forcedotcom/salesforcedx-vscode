/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { GatedSpanExporter } from '../../../src/observability/gatedSpanExporter';

// GatedSpanExporter is decoupled from telemetry config: the gate is an injected predicate.
const enabled = (): boolean => true;
const disabled = (): boolean => false;

const spans = [{ name: 'span' } as unknown as ReadableSpan];

const makeFakeExporter = (): SpanExporter & { export: jest.Mock; shutdown: jest.Mock } => ({
  export: jest.fn((_spans: ReadableSpan[], cb: (r: ExportResult) => void) => cb({ code: ExportResultCode.SUCCESS })),
  shutdown: jest.fn().mockResolvedValue(undefined)
});

describe('GatedSpanExporter', () => {
  it('disabled: returns SUCCESS and NEVER constructs the delegate (no Statsbeat/network setup)', () => {
    const make = jest.fn(makeFakeExporter);
    const exporter = new GatedSpanExporter(make, disabled);

    const cb = jest.fn();
    exporter.export(spans, cb);

    expect(cb).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
    // the assertion the injected-fake-sender fixture could not make: delegate ctor never runs
    expect(make).not.toHaveBeenCalled();
  });

  it('enabled: constructs the delegate once, caches it, and forwards spans on each export', () => {
    const fake = makeFakeExporter();
    const make = jest.fn(() => fake);
    const exporter = new GatedSpanExporter(make, enabled);

    exporter.export(spans, jest.fn());
    exporter.export(spans, jest.fn());

    expect(make).toHaveBeenCalledTimes(1);
    expect(fake.export).toHaveBeenCalledTimes(2);
    expect(fake.export.mock.calls[0][0]).toBe(spans);
  });

  it('re-checks the gate per export: enabled then disabled stops forwarding without re-construct', () => {
    const fake = makeFakeExporter();
    const make = jest.fn(() => fake);
    let on = true;
    const exporter = new GatedSpanExporter(make, () => on);

    exporter.export(spans, jest.fn());
    on = false;
    const cb = jest.fn();
    exporter.export(spans, cb);

    expect(make).toHaveBeenCalledTimes(1);
    expect(fake.export).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ code: ExportResultCode.SUCCESS });
  });

  it('shutdown before any export resolves without constructing the delegate', async () => {
    const make = jest.fn(makeFakeExporter);
    const exporter = new GatedSpanExporter(make, enabled);

    await expect(exporter.shutdown()).resolves.toBeUndefined();
    expect(make).not.toHaveBeenCalled();
  });

  it('shutdown after an enabled export delegates to the constructed exporter', async () => {
    const fake = makeFakeExporter();
    const exporter = new GatedSpanExporter(() => fake, enabled);

    exporter.export(spans, jest.fn());
    await exporter.shutdown();

    expect(fake.shutdown).toHaveBeenCalledTimes(1);
  });
});
