/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as OtelTracer from '@effect/opentelemetry/OtelTracer';
import * as Resource from '@effect/opentelemetry/Resource';
import type { ReadableLogRecord } from '@opentelemetry/sdk-logs';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { CliId, OrgId, TargetOrgRef } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Schema from 'effect/Schema';
import * as FetchHttpClient from 'effect/http/FetchHttpClient';
import * as OtlpExporter from 'effect/observability/OtlpExporter';
import { OrgChanges, orgLayers } from '../../../src/services/targetOrgRef';
import * as appInsights from '../../../src/observability/appInsights';
import { redactingConsoleLoggerLayer } from '../../../src/observability/redactingConsoleLogger';
import { NodeSdkLayerFor } from '../../../src/observability/spansNode';
import { getSpanCreationIdentity } from '../../../src/observability/spanTransformProcessor';
import { ServicesSdkLayer } from '../../../src/observability/spans';

const { exportedSpans, exportedLogs, localTraces } = vi.hoisted(() => ({
  exportedSpans: [] as ReadableSpan[],
  exportedLogs: [] as ReadableLogRecord[],
  localTraces: { enabled: false }
}));
vi.mock('../../../src/observability/localTracing', () => ({
  getConsoleTracesEnabled: () => false,
  getLocalTracesEnabled: () => localTraces.enabled,
  getFileTracesEnabled: () => true,
  getLogLevel: () => 'Info'
}));
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  // eslint-disable-next-line prefer-arrow/prefer-arrow-functions -- Native SDK constructs the exporter with new.
  OTLPTraceExporter: vi.fn(function () {
    return {
      export: (_spans: ReadableSpan[], callback: (result: { code: number }) => void) => callback({ code: 0 }),
      shutdown: () => Promise.resolve()
    };
  })
}));

beforeEach(() => {
  exportedSpans.length = 0;
  exportedLogs.length = 0;
  localTraces.enabled = false;
});
vi.mock('../../../src/observability/otlpFileSpanExporterNode', () => ({
  // eslint-disable-next-line prefer-arrow/prefer-arrow-functions -- The SDK calls this mock with new; arrows are not constructors.
  OtlpFileSpanExporterNode: vi.fn(function () {
    return {
      export: (spans: ReadableSpan[], callback: (result: { code: number }) => void) => {
        exportedSpans.push(...spans);
        callback({ code: 0 });
      },
      shutdown: () => Promise.resolve()
    };
  })
}));
vi.mock('../../../src/observability/otlpFileLogExporterNode', () => ({
  // eslint-disable-next-line prefer-arrow/prefer-arrow-functions -- The SDK calls this mock with new; arrows are not constructors.
  OtlpFileLogExporterNode: vi.fn(function () {
    return {
      export: (logs: ReadableLogRecord[], callback: (result: { code: number }) => void) => {
        exportedLogs.push(...logs);
        callback({ code: 0 });
      },
      shutdown: () => Promise.resolve()
    };
  })
}));

it('uses one authoritative org ref before runtime publication, freezes span identity and retains per-extension SDK/console loggers', async () => {
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(appInsights, 'isProductionTelemetryExportEnabled').mockReturnValue(false);
  const owner = ManagedRuntime.make(orgLayers);
  const ref = await owner.runPromise(TargetOrgRef);
  const changes = await owner.runPromise(OrgChanges);
  const orgA = Schema.decodeUnknownSync(OrgId)('00D000000000001');
  const orgB = Schema.decodeUnknownSync(OrgId)('00D000000000002');
  const cliId = Schema.decodeUnknownSync(CliId)('00000000-0000-4000-8000-000000000001');
  const updateOrg = (orgId: typeof orgA) =>
    changes.begin.pipe(
      Effect.flatMap(generation =>
        changes.update(generation, () => Effect.succeed({ orgId, cliId, instanceName: 'NA1' }))
      )
    );
  const sdkFor = (extensionName: string) =>
    ManagedRuntime.make(
      NodeSdkLayerFor({ extensionName, extensionVersion: '1.0.0' }).pipe(
        Layer.provide(Layer.succeed(TargetOrgRef, ref)),
        Layer.provideMerge(redactingConsoleLoggerLayer)
      )
    );
  const first = sdkFor('first-extension');
  const second = sdkFor('second-extension');
  try {
    await owner.runPromise(updateOrg(orgA));
    const spanA = await first.runPromise(
      OtelTracer.currentOtelSpan.pipe(
        Effect.tap(() => Effect.logInfo('first log 00D000000000000!secret')),
        Effect.withSpan('first.command')
      )
    );
    await owner.runPromise(updateOrg(orgB));
    const spanB = await second.runPromise(
      OtelTracer.currentOtelSpan.pipe(
        Effect.tap(() => Effect.logInfo('second log')),
        Effect.withSpan('second.command')
      )
    );
    expect(getSpanCreationIdentity(spanA).orgId).toBe(orgA);
    expect(getSpanCreationIdentity(spanB).orgId).toBe(orgB);
    expect(getSpanCreationIdentity(spanA).cliId).toBe(cliId);
    expect(spanA).toMatchObject({ resource: { attributes: { 'extension.name': 'first-extension' } } });
    expect(spanB).toMatchObject({ resource: { attributes: { 'extension.name': 'second-extension' } } });
    expect(consoleLog).toHaveBeenCalledTimes(2);
    expect(consoleLog.mock.calls.flat().join(' ')).not.toContain('!secret');
    await first.dispose();
    await second.dispose();
    expect(exportedSpans.filter(span => span.name === 'first.command')).toHaveLength(1);
    expect(exportedSpans.filter(span => span.name === 'second.command')).toHaveLength(1);
    const events = exportedSpans.find(span => span.name === 'first.command')?.events;
    expect(events).toHaveLength(1);
    expect(events?.[0]?.name).toContain('first log');
    expect(events?.[0]?.name).not.toContain('!secret');
    expect(exportedLogs.map(log => log.resource.attributes['extension.name'])).toEqual([
      'first-extension',
      'second-extension'
    ]);
  } finally {
    await first.dispose();
    await second.dispose();
    await owner.dispose();
    vi.restoreAllMocks();
  }
});

it('flushes local OTLP and SDK file logs together before owner disposal, with one console message', async () => {
  localTraces.enabled = true;
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(appInsights, 'isProductionTelemetryExportEnabled').mockReturnValue(false);
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(new Response('{}')));
  const owner = ManagedRuntime.make(orgLayers);
  const ref = await owner.runPromise(TargetOrgRef);
  const sdk = ManagedRuntime.make(
    NodeSdkLayerFor({ extensionName: 'both-sinks', extensionVersion: '1.0.0' }).pipe(
      Layer.provide(Layer.succeed(TargetOrgRef, ref)),
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
      Layer.provideMerge(redactingConsoleLoggerLayer)
    )
  );
  try {
    await sdk.runPromise(Effect.logInfo('both sinks log'));
    await sdk.runPromise(OtlpExporter.Flusher.use(flusher => flusher.flush));
    expect(exportedLogs).toHaveLength(1);
    expect(exportedLogs[0]?.resource.attributes['extension.name']).toBe('both-sinks');
    expect(consoleLog).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    const body = await new Response(fetch.mock.calls[0]?.[1]?.body).text();
    expect(body).toContain('both sinks log');
    expect(body).toContain('both-sinks');
    expect(await owner.runPromise(TargetOrgRef)).toBe(ref);
  } finally {
    await sdk.dispose();
    await owner.dispose();
    vi.restoreAllMocks();
  }
});

it('shares one services SDK across bootstrap and domain scopes with the same memo map', async () => {
  vi.spyOn(appInsights, 'isProductionTelemetryExportEnabled').mockReturnValue(false);
  const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const orgOwner = ManagedRuntime.make(orgLayers);
  const ref = await orgOwner.runPromise(TargetOrgRef);
  const target = Layer.succeed(TargetOrgRef, ref);
  const memoMap = Layer.makeMemoMapUnsafe();
  const bootstrap = ManagedRuntime.make(
    ServicesSdkLayer().pipe(Layer.provide(target), Layer.provideMerge(redactingConsoleLoggerLayer)),
    { memoMap }
  );
  const domain = ManagedRuntime.make(
    ServicesSdkLayer().pipe(Layer.provide(target), Layer.provideMerge(redactingConsoleLoggerLayer)),
    { memoMap }
  );
  try {
    const bootstrapResource = await bootstrap.runPromise(Resource.Resource);
    expect(await domain.runPromise(Resource.Resource)).toBe(bootstrapResource);
    await bootstrap.dispose();
    await domain.runPromise(Effect.logInfo('domain remains active'));
    await domain.runPromise(OtlpExporter.Flusher.use(flusher => flusher.flush));
    expect(exportedLogs).toHaveLength(1);
    expect(consoleLog).toHaveBeenCalledTimes(1);
  } finally {
    await bootstrap.dispose();
    await domain.dispose();
    await orgOwner.dispose();
    vi.restoreAllMocks();
  }
});
