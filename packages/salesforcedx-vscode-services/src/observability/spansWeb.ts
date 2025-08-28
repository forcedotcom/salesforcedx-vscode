/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WebSdk } from '@effect/opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-web';
import { isTelemetryExtensionConfigurationEnabled } from './appInsights';
import { ApplicationInsightsWebExporter } from './applicationInsightsWebExporter';
import { getLocalTracesEnabled } from './localTracing';
import { SpanTransformProcessor } from './spanTransformProcessor';

export const WebSdkLayer = WebSdk.layer(() => ({
  resource: {
    serviceName: 'salesforcedx-vscode-services',
    //manually bump this to cause rebuilds/bust cache
    serviceVersion: '2025-08-15T20:49:30.000Z',
    attributes: {
      'service.environment': 'vscode-extension',
      'service.platform': 'web'
    }
  },
  spanProcessor: [
    new SpanTransformProcessor(new ConsoleSpanExporter()),
    ...(isTelemetryExtensionConfigurationEnabled()
      ? [new SpanTransformProcessor(new ApplicationInsightsWebExporter())]
      : []),
    ...(getLocalTracesEnabled() ? [new SpanTransformProcessor(new OTLPTraceExporter())] : [])
  ]
}));
