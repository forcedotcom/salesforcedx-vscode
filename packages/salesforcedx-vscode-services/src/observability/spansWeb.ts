/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SdkLayerConfig } from './sdkLayerConfig';
import { WebSdk } from '@effect/opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-web';
import { isProductionTelemetryExportEnabled } from './appInsights';
import { ApplicationInsightsWebExporter } from './applicationInsightsWebExporter';
import { GatedSpanExporter } from './gatedSpanExporter';
import { getConsoleTracesEnabled, getLocalTracesEnabled, getFileTracesEnabled } from './localTracing';
import { O11ySpanExporter } from './o11ySpanExporter';
import { OtlpFileSpanExporterWeb } from './otlpFileSpanExporterWeb';
import { SpanTransformProcessor } from './spanTransformProcessor';

export const WebSdkLayerFor = ({ extensionName, extensionVersion, o11yEndpoint, productFeatureId }: SdkLayerConfig) =>
  WebSdk.layer(() => ({
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
      // AI processor always present; GatedSpanExporter re-checks the telemetry setting per export (mid-session toggle)
      new SpanTransformProcessor(
        new GatedSpanExporter(
          () => new ApplicationInsightsWebExporter(),
          () => isProductionTelemetryExportEnabled()
        ),
        undefined,
        // skip per-span attribute enrichment when the gate is disabled (attrs would be discarded)
        () => isProductionTelemetryExportEnabled()
      ),
      // O11y processor present whenever an endpoint is configured; gate (localhost bypass + telemetry setting) lives in the wrapper
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
      ...(getFileTracesEnabled() ? [new SpanTransformProcessor(new OtlpFileSpanExporterWeb())] : [])
    ]
  }));
