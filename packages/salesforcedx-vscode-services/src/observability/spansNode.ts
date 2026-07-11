/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SdkLayerConfig } from './sdkLayerConfig';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { NodeSdk, OtlpLogger, OtlpSerialization } from '@effect/opentelemetry';
import { FetchHttpClient } from '@effect/platform';
import type { ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { ConsoleSpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { Global } from '@salesforce/core/global';
import * as Layer from 'effect/Layer';
import * as Logger from 'effect/Logger';
import { join } from 'node:path';
import { DEFAULT_AI_CONNECTION_STRING, isProductionTelemetryExportEnabled } from './appInsights';
import { ApplicationInsightsNodeExporter } from './applicationInsightsNodeExporter';
import { GatedSpanExporter } from './gatedSpanExporter';
import { makeLocalEnvelopeSender } from './localEnvelopeSender';
import { getConsoleTracesEnabled, getFileTracesEnabled, getLocalTracesEnabled, getLogLevel } from './localTracing';
import { O11ySpanExporter } from './o11ySpanExporter';
import { OtlpFileLogExporterNode } from './otlpFileLogExporterNode';
import { OtlpFileSpanExporterNode } from './otlpFileSpanExporterNode';
import { SpanTransformProcessor } from './spanTransformProcessor';
import { isSpanValidForProductionTelemetry } from './spanUtils';

export class FilteredAzureMonitorTraceExporter extends AzureMonitorTraceExporter {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
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

  return NodeSdk.layer(() => ({
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
      ...(getConsoleTracesEnabled() ? [new SpanTransformProcessor(new ConsoleSpanExporter())] : []),
      // AI processor always present; GatedSpanExporter re-checks the telemetry setting per export
      // (mid-session toggle) and lazily constructs the delegate on first enabled export so a
      // disabled session runs no delegate ctor (no Azure Statsbeat/network setup).
      new SpanTransformProcessor(
        new GatedSpanExporter(
          () =>
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
          () => isProductionTelemetryExportEnabled()
        ),
        enableCustomEventsFromSpans || localIngestionEndpoint
          ? undefined
          : {
              exportTimeoutMillis: 15_000,
              maxQueueSize: 1000
            },
        // skip per-span attribute enrichment when the gate is disabled (attrs would be discarded)
        () => isProductionTelemetryExportEnabled()
      ),
      // O11y processor present whenever an endpoint is configured; the gate (localhost bypass +
      // telemetry setting) now lives in GatedSpanExporter and is re-checked per export.
      ...(o11yEndpoint
        ? [
            new SpanTransformProcessor(
              new GatedSpanExporter(
                () => new O11ySpanExporter(extensionName, o11yEndpoint, productFeatureId),
                () => isProductionTelemetryExportEnabled(o11yEndpoint)
              ),
              undefined,
              () => isProductionTelemetryExportEnabled(o11yEndpoint)
            )
          ]
        : []),
      ...(getLocalTracesEnabled() ? [new SpanTransformProcessor(new OTLPTraceExporter())] : []),
      ...(getFileTracesEnabled() ? [new SpanTransformProcessor(new OtlpFileSpanExporterNode())] : [])
    ],
    logRecordProcessor: [
      ...(getFileTracesEnabled() ? [new SimpleLogRecordProcessor(new OtlpFileLogExporterNode())] : [])
    ]
  })).pipe(
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
