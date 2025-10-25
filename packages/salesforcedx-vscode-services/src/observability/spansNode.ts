/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { NodeSdk } from '@effect/opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { Global } from '@salesforce/core/global';
import { join } from 'node:path';
import { DEFAULT_AI_CONNECTION_STRING, isTelemetryExtensionConfigurationEnabled } from './appInsights';
import { getConsoleTracesEnabled, getLocalTracesEnabled } from './localTracing';
import { SpanTransformProcessor } from './spanTransformProcessor';

export const NodeSdkLayer = NodeSdk.layer(() => ({
  resource: {
    serviceName: 'salesforcedx-vscode-services',
    //manually bump this to cause rebuilds/bust cache
    serviceVersion: '2025-08-15T20:49:30.000Z',
    attributes: {}
  },
  spanProcessor: [
    ...(getConsoleTracesEnabled() ? [new SpanTransformProcessor(new ConsoleSpanExporter())] : []),
    ...(isTelemetryExtensionConfigurationEnabled()
      ? [
          new SpanTransformProcessor(
            new AzureMonitorTraceExporter({
              connectionString: DEFAULT_AI_CONNECTION_STRING,
              storageDirectory: join(Global.SF_DIR, 'vscode-extensions-telemetry')
            }),
            {
              exportTimeoutMillis: 15000,
              maxQueueSize: 1000
            }
          )
        ]
      : []),
    ...(getLocalTracesEnabled() ? [new SpanTransformProcessor(new OTLPTraceExporter())] : [])
  ]
}));
