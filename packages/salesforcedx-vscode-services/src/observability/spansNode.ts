/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SdkLayerConfig } from './sdkLayerConfig';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { NodeSdk } from '@effect/opentelemetry';
import type { ExportResult } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter, type ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { Global } from '@salesforce/core/global';
import { join } from 'node:path';
import { DEFAULT_AI_CONNECTION_STRING, isTelemetryExtensionConfigurationEnabled } from './appInsights';
import { FileSpanExporterNode } from './fileSpanExporterNode';
import { getConsoleTracesEnabled, getFileTracesEnabled, getLocalTracesEnabled } from './localTracing';
import { O11ySpanExporter } from './o11ySpanExporter';
import { SpanTransformProcessor } from './spanTransformProcessor';
import { isSpanValidForProductionTelemetry } from './spanUtils';

class FilteredAzureMonitorTraceExporter extends AzureMonitorTraceExporter {
  public override async export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): Promise<void> {
    return super.export(spans.filter(isSpanValidForProductionTelemetry), resultCallback);
  }
}

export const NodeSdkLayerFor = ({ extensionName, extensionVersion, o11yEndpoint, productFeatureId }: SdkLayerConfig) =>
  NodeSdk.layer(() => ({
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
      ...(isTelemetryExtensionConfigurationEnabled()
        ? [
            new SpanTransformProcessor(
              new FilteredAzureMonitorTraceExporter({
                connectionString: DEFAULT_AI_CONNECTION_STRING,
                storageDirectory: join(Global.SF_DIR, 'vscode-extensions-telemetry')
              }),
              {
                exportTimeoutMillis: 15_000,
                maxQueueSize: 1000
              }
            )
          ]
        : []),
      ...(o11yEndpoint && (o11yEndpoint.includes('localhost') || isTelemetryExtensionConfigurationEnabled())
        ? [new SpanTransformProcessor(new O11ySpanExporter(extensionName, o11yEndpoint, productFeatureId))]
        : []),
      ...(getLocalTracesEnabled() ? [new SpanTransformProcessor(new OTLPTraceExporter())] : []),
      ...(getFileTracesEnabled() ? [new SpanTransformProcessor(new FileSpanExporterNode(extensionName))] : [])
    ]
  }));
