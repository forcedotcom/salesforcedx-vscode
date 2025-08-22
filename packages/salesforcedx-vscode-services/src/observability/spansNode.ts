/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { NodeSdk } from '@effect/opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

export const NodeSdkLayer = NodeSdk.layer(() => ({
  resource: {
    serviceName: 'salesforcedx-vscode-services',
    //manually bump this to cause rebuilds/bust cache
    serviceVersion: '2025-08-15T20:49:30.000Z',
    attributes: {}
  },
  spanProcessor: [new BatchSpanProcessor(new ConsoleSpanExporter()), new BatchSpanProcessor(new OTLPTraceExporter())]
}));
