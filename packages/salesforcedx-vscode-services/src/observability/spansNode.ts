/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SdkLayerConfig } from './spans';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { NodeSdk } from '@effect/opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { Global } from '@salesforce/core/global';
import { join } from 'node:path';
import { DEFAULT_AI_CONNECTION_STRING, isTelemetryExtensionConfigurationEnabled } from './appInsights';
import { getConsoleTracesEnabled, getLocalTracesEnabled } from './localTracing';
import { O11ySpanExporter } from './o11ySpanExporter';
import { SpanTransformProcessor } from './spanTransformProcessor';

export const NodeSdkLayerFor = ({ extensionName, extensionVersion, o11yEndpoint }: SdkLayerConfig) =>
  NodeSdk.layer(() => ({
    resource: {
      serviceName: extensionName,
      //manually bump this to cause rebuilds/bust cache
      serviceVersion: '2026-01-07T10:12.004Z',
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
              new AzureMonitorTraceExporter({
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
        ? [new SpanTransformProcessor(new O11ySpanExporter(extensionName, o11yEndpoint))]
        : []),
      ...(getLocalTracesEnabled() ? [new SpanTransformProcessor(new OTLPTraceExporter())] : [])
    ]
  }));
