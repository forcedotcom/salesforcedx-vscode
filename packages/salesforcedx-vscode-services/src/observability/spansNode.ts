/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SdkLayerConfig } from './sdkLayerConfig';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { NodeSdk, OtlpLogger, OtlpSerialization } from '@effect/opentelemetry';
import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import type { ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { ConsoleSpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { Global } from '@salesforce/core/global';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import { join } from 'node:path';
import { DEFAULT_AI_CONNECTION_STRING } from './appInsights';
import { ApplicationInsightsNodeExporter } from './applicationInsightsNodeExporter';
import { GatedSpanExporter } from './gatedSpanExporter';
import { makeLocalEnvelopeSender } from './localEnvelopeSender';
import { getConsoleTracesEnabled, getFileTracesEnabled, getLocalTracesEnabled, getLogLevel } from './localTracing';
import { O11ySpanExporter } from './o11ySpanExporter';
import { OtlpFileLogExporterNode } from './otlpFileLogExporterNode';
import { OtlpFileSpanExporterNode } from './otlpFileSpanExporterNode';
import { RedactingSpanProcessor } from './redactingSpanProcessor';
import { SpanTransformProcessor } from './spanTransformProcessor';
import { isSpanValidForProductionTelemetry } from './spanUtils';

export class FilteredAzureMonitorTraceExporter extends AzureMonitorTraceExporter {
  constructor(options: ConstructorParameters<typeof AzureMonitorTraceExporter>[0], localIngestionEndpoint?: string) {
    super(options);
    // @ts-expect-error -- `shouldCreateResourceMetric` is a private SDK field; suppresses the never-sampled _OTELRESOURCE_/_APPRESOURCEPREVIEW_ metric (~22% AI ingestion).
    this.shouldCreateResourceMetric = false;
    // Dev/test: divert envelopes to the local span file server over plain HTTP. The Azure SDK
    // force-upgrades http→https (connectionStringParser.sanitizeUrl), so the endpoint can't be
    // carried in the connection string — we swap the private sender instead. See localEnvelopeSender.
    if (localIngestionEndpoint) {
      // @ts-expect-error -- `sender` is a private SDK field; intentionally overriding the transport.
      this.sender = makeLocalEnvelopeSender(localIngestionEndpoint);
    }
  }

  public override async export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): Promise<void> {
    return super.export(spans.filter(isSpanValidForProductionTelemetry), resultCallback);
  }
}

export const NodeSdkLayerFor = ({
  extensionName,
  extensionVersion,
  o11yEndpoint,
  productFeatureId,
  enableCustomEventsFromSpans,
  connectionString,
  localIngestionEndpoint
}: SdkLayerConfig) => {
  // connectionString is normalized (otelConnectionString preferred over aiKey, bare UUIDs wrapped)
  // and defaulted by sdkLayerConfig.ts. This `?? DEFAULT` is a safety net for SdkLayerConfig
  // constructed directly (e.g. tests) without going through those helpers.
  const effectiveConnectionString = connectionString ?? DEFAULT_AI_CONNECTION_STRING;

  // localIngestionEndpoint is set in dev/test (sdkLayerConfig.resolveLocalIngestionEndpoint) and, when
  // present, diverts App Insights envelopes to the local span file server (see exporters below).

  return NodeSdk.layer(
    Effect.gen(function* () {
      return {
        resource: {
          serviceName: extensionName,
          //manually bump this to cause rebuilds/bust cache
          serviceVersion: '2026-03-02T01:00.304Z',
          attributes: {
            'extension.name': extensionName,
            'extension.version': extensionVersion
          }
        },
        spanProcessor: [
          // first and unconditional: rewrites secret-shaped text during onEnding, which MultiSpanProcessor
          // runs on every processor before any onEnd, so every sink below receives redacted spans
          new RedactingSpanProcessor(),
          ...(getConsoleTracesEnabled() ? [new SpanTransformProcessor({ exporter: new ConsoleSpanExporter() })] : []),
          // AI processor always present; GatedSpanExporter re-checks the telemetry setting per export
          // (mid-session toggle) and lazily constructs the delegate on first enabled export so a
          // disabled session runs no delegate ctor (no Azure Statsbeat/network setup).
          new SpanTransformProcessor({
            exporter: new GatedSpanExporter({
              make: () =>
                enableCustomEventsFromSpans
                  ? // customEvents path (LogRecord-based); localIngestionEndpoint diverts to local server in dev/test
                    new ApplicationInsightsNodeExporter(effectiveConnectionString, localIngestionEndpoint)
                  : // dependencies path; localIngestionEndpoint diverts to local server in dev/test
                    new FilteredAzureMonitorTraceExporter(
                      {
                        connectionString: effectiveConnectionString,
                        storageDirectory: join(Global.SF_DIR, 'vscode-extensions-telemetry')
                      },
                      localIngestionEndpoint
                    ),
              bypassGovernance: Boolean(localIngestionEndpoint)
            }),
            options:
              enableCustomEventsFromSpans || localIngestionEndpoint
                ? undefined
                : {
                    exportTimeoutMillis: 15_000,
                    maxQueueSize: 1000
                  }
          }),
          // O11y processor present whenever an endpoint is configured; the gate (localhost bypass +
          // telemetry setting) now lives in GatedSpanExporter and is re-checked per export.
          ...(o11yEndpoint
            ? [
                new SpanTransformProcessor({
                  exporter: new GatedSpanExporter({
                    // localIngestionEndpoint (dev/test) diverts O11y events to the local span file server's
                    // /o11y route instead of uploading through the org connection — mirrors the AI divert.
                    make: () =>
                      new O11ySpanExporter(extensionName, o11yEndpoint, productFeatureId, localIngestionEndpoint),
                    o11yEndpoint,
                    bypassGovernance: Boolean(localIngestionEndpoint)
                  })
                })
              ]
            : []),
          ...(getLocalTracesEnabled() ? [new SpanTransformProcessor({ exporter: new OTLPTraceExporter() })] : []),
          ...(getFileTracesEnabled() ? [new SpanTransformProcessor({ exporter: new OtlpFileSpanExporterNode() })] : [])
        ],
        logRecordProcessor: [
          ...(getFileTracesEnabled() ? [new SimpleLogRecordProcessor(new OtlpFileLogExporterNode())] : [])
        ]
      };
    })
  ).pipe(
    Layer.merge(Logger.minimumLogLevel(getLogLevel())),
    Layer.merge(
      getLocalTracesEnabled()
        ? OtlpLogger.layer({
            // OTLPTraceExporter reads OTEL_EXPORTER_OTLP_ENDPOINT internally; OtlpLogger does not, so we resolve it here
            url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'}/v1/logs`,
            resource: { serviceName: extensionName, serviceVersion: extensionVersion }
          }).pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(OtlpSerialization.layerJson))
        : Layer.empty
    )
  );
};
