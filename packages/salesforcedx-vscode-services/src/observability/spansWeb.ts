/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SdkLayerConfig } from './sdkLayerConfig';
import { WebSdk } from '@effect/opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-web';
import { DEFAULT_AI_CONNECTION_STRING, isTelemetryExtensionConfigurationEnabled } from './appInsights';
import { ApplicationInsightsWebExporter } from './applicationInsightsWebExporter';
import { AzureMonitorLogExporterWrapper } from './azureMonitorLogExporterWrapper';
import { getConsoleTracesEnabled, getLocalTracesEnabled, getFileTracesEnabled } from './localTracing';
import { O11ySpanExporter } from './o11ySpanExporter';
import { OtlpFileSpanExporterWeb } from './otlpFileSpanExporterWeb';
import { SpanToCustomEventProcessor } from './spanToCustomEventProcessor';
import { SpanTransformProcessor } from './spanTransformProcessor';

export const WebSdkLayerFor = ({
  extensionName,
  extensionVersion,
  o11yEndpoint,
  productFeatureId,
  enableCustomEventsFromSpans,
  connectionString
}: SdkLayerConfig) => {
  // Use consumer's connection string if provided, otherwise fall back to services package default
  const effectiveConnectionString = connectionString ?? DEFAULT_AI_CONNECTION_STRING;

  return WebSdk.layer(() => ({
    resource: {
      serviceName: extensionName,
      //manually bump this to cause rebuilds/bust cache
      serviceVersion: '2026-03-10T10:38.004Z',
      attributes: {
        'extension.name': extensionName,
        'extension.version': extensionVersion,
        'service.environment': 'vscode-extension',
        'service.platform': 'web'
      }
    },
    spanProcessor: [
      ...(getConsoleTracesEnabled() ? [new SpanTransformProcessor(new ConsoleSpanExporter())] : []),
      ...(isTelemetryExtensionConfigurationEnabled()
        ? [new SpanTransformProcessor(new ApplicationInsightsWebExporter())]
        : []),
      ...(o11yEndpoint && (o11yEndpoint.includes('localhost') || isTelemetryExtensionConfigurationEnabled())
        ? [new SpanTransformProcessor(new O11ySpanExporter(extensionName, o11yEndpoint, productFeatureId))]
        : []),
      ...(getLocalTracesEnabled() ? [new SpanTransformProcessor(new OTLPTraceExporter())] : []),
      ...(getFileTracesEnabled() ? [new SpanTransformProcessor(new OtlpFileSpanExporterWeb())] : []),
      // SpanProcessor that emits LogRecords for customEvents table routing
      ...(enableCustomEventsFromSpans ? [new SpanToCustomEventProcessor()] : [])
    ],
    logRecordProcessor: [
      // Azure Monitor log exporter routes LogRecords with "microsoft.custom_event.name" to customEvents table
      ...(enableCustomEventsFromSpans && isTelemetryExtensionConfigurationEnabled()
        ? [
            new SimpleLogRecordProcessor(
              new AzureMonitorLogExporterWrapper({
                connectionString: effectiveConnectionString
              })
            )
          ]
        : [])
    ]
  }));
};
