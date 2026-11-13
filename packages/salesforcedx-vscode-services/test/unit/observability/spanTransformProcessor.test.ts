/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MockInstance as VitestMockInstance } from 'vitest';
import * as os from 'node:os';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import { setImmediate } from 'node:timers/promises';
import {
  isInternalUser,
  setSpanCreationIdentity,
  SpanTransformProcessor
} from '../../../src/observability/spanTransformProcessor';

describe('isInternalUser', () => {
  let hostnameSpy: VitestMockInstance;

  beforeEach(() => {
    hostnameSpy = vi.spyOn(os, 'hostname').mockReturnValue('laptop.example.com');
  });

  it('should return true on Desktop when hostname ends with internal.salesforce.com', () => {
    hostnameSpy.mockReturnValue('machine.internal.salesforce.com');
    expect(isInternalUser('Desktop')).toBe('true');
  });

  it('should return false on Desktop when hostname does not match', () => {
    expect(isInternalUser('Desktop')).toBe('false');
  });

  it('should return undefined on Web', () => {
    expect(isInternalUser('Web')).toBeUndefined();
  });

  it('should return false on Desktop when os.hostname is unavailable', () => {
    hostnameSpy.mockReturnValue(undefined);
    expect(isInternalUser('Desktop')).toBe('false');
  });

  it('should return undefined when uiKindString is undefined', () => {
    hostnameSpy.mockReturnValue('machine.internal.salesforce.com');
    expect(isInternalUser(undefined)).toBeUndefined();
    expect(hostnameSpy).not.toHaveBeenCalled();
  });
});

describe('SpanTransformProcessor legacy identity', () => {
  it('removes live identity that is absent from the frozen send-time snapshot', () => {
    const attributes: Record<string, string | number> = { telemetrySource: 'legacy' };
    const span = {
      parentSpanContext: undefined,
      resource: { attributes: { 'extension.name': 'caller-ext', 'extension.version': '1.0.0' } },
      attributes,
      setAttribute: vi.fn((key: string, value: string | number) => {
        attributes[key] = value;
      })
    } as unknown as Parameters<SpanTransformProcessor['onStart']>[0];
    const processor = new SpanTransformProcessor({
      exporter: {} as never,
      getIdentitySnapshot: () => ({ orgId: 'live-org', telemetryClassification: 'nonGov' }) as never
    });

    processor.onStart(span, {} as Parameters<SpanTransformProcessor['onStart']>[1]);
    setSpanCreationIdentity(span, { telemetryClassification: 'unknown' });
    processor.onEnding(span);

    expect(attributes.orgId).toBeUndefined();
    expect(attributes.userId).toBeUndefined();
    expect(attributes.isSandbox).toBeUndefined();
    expect(attributes['common.vscodemachineid']).toEqual(expect.any(String));
  });
});

it('awaits the exporter buffer after its SDK span batch and preserves flush failures', async () => {
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const flush = vi.fn(() => {
    started.resolve();
    return release.promise;
  });
  const processor = new SpanTransformProcessor({
    exporter: { export: vi.fn(), shutdown: () => Promise.resolve(), forceFlush: flush },
    getIdentitySnapshot: () => ({ telemetryClassification: 'unknown' })
  });
  let finished = false;
  const flushing = processor.forceFlush().then(() => {
    finished = true;
  });
  await started.promise;
  expect(finished).toBe(false);
  release.resolve();
  await flushing;
  const defect = new Error('native exporter flush failed');
  flush.mockRejectedValueOnce(defect);
  await expect(processor.forceFlush()).rejects.toBe(defect);
  await processor.shutdown();
});

it('awaits an automatic native export already in flight before draining downstream buffers', async () => {
  const started = Promise.withResolvers<(result: ExportResult) => void>();
  const downstreamFlush = vi.fn(() => Promise.resolve());
  const processor = new SpanTransformProcessor({
    exporter: {
      export: (_spans, complete) => started.resolve(complete),
      shutdown: () => Promise.resolve(),
      forceFlush: downstreamFlush
    },
    options: { maxExportBatchSize: 1, maxQueueSize: 1 },
    getIdentitySnapshot: () => ({ telemetryClassification: 'unknown' })
  });
  const provider = new NodeTracerProvider({ spanProcessors: [processor] });
  provider.getTracer('automatic-export').startSpan('automatic').end();
  const callback = await started.promise;
  let completed = false;
  let flushed = false;
  const flushing = processor.forceFlush().then(() => {
    flushed = true;
  });
  try {
    await setImmediate();
    expect(flushed).toBe(false);
    expect(downstreamFlush).not.toHaveBeenCalled();
    callback({ code: ExportResultCode.SUCCESS });
    completed = true;
    await flushing;
    expect(downstreamFlush).toHaveBeenCalledTimes(1);
  } finally {
    if (!completed) callback({ code: ExportResultCode.SUCCESS });
    await provider.shutdown();
  }
});
