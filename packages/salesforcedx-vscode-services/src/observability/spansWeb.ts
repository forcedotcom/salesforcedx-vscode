/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SdkLayerConfig } from './spans';
import { WebSdk } from '@effect/opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-web';
import { isTelemetryExtensionConfigurationEnabled } from './appInsights';
import { ApplicationInsightsWebExporter } from './applicationInsightsWebExporter';
import { getConsoleTracesEnabled, getLocalTracesEnabled } from './localTracing';
import { O11ySpanExporter } from './o11ySpanExporter';
import { SpanTransformProcessor } from './spanTransformProcessor';

export const WebSdkLayerFor = ({ extensionName, extensionVersion, o11yEndpoint }: SdkLayerConfig) =>
  WebSdk.layer(() => ({
    resource: {
      serviceName: extensionName,
      //manually bump this to cause rebuilds/bust cache
      serviceVersion: '2026-01-08T10:38.004Z',
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
        ? [new SpanTransformProcessor(new O11ySpanExporter(extensionName, o11yEndpoint))]
        : []),
      ...(getLocalTracesEnabled() ? [new SpanTransformProcessor(new OTLPTraceExporter())] : [])
    ]
  }));
