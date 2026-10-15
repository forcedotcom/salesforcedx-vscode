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
import * as Effect from 'effect/Effect';
import { ApplicationInsightsWebExporter } from './applicationInsightsWebExporter';
import { GatedSpanExporter } from './gatedSpanExporter';
import { getLegacyCallerFalcon } from './legacyTelemetrySender';
import { getConsoleTracesEnabled, getLocalTracesEnabled, getFileTracesEnabled } from './localTracing';
import { O11yRoutingExporter } from './o11yRoutingExporter';
import { O11ySpanExporter } from './o11ySpanExporter';
import { OtlpFileSpanExporterWeb } from './otlpFileSpanExporterWeb';
import { RedactingSpanProcessor } from './redactingSpanProcessor';
import { SpanTransformProcessor } from './spanTransformProcessor';

export const WebSdkLayerFor = ({
  extensionName,
  extensionVersion,
  o11yEndpoint,
  productFeatureId,
  falcon
}: SdkLayerConfig) =>
  WebSdk.layer(
    Effect.gen(function* () {
      return {
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
          // first and unconditional: rewrites sensitive-data-shaped text during onEnding, which MultiSpanProcessor
          // runs on every processor before any onEnd, so every sink below receives redacted spans
          new RedactingSpanProcessor(),
          ...(getConsoleTracesEnabled() ? [new SpanTransformProcessor({ exporter: new ConsoleSpanExporter() })] : []),
          // AI processor always present; GatedSpanExporter re-checks the telemetry setting per export (mid-session toggle)
          new SpanTransformProcessor({
            exporter: new GatedSpanExporter({
              make: () => new ApplicationInsightsWebExporter(),
              bypassGovernance: process.env.ESBUILD_WEB_LOCAL === '1'
            })
          }),
          // O11y processor always present; O11yRoutingExporter restores per-caller
          // endpoint/PFT for legacy spans and drops rest spans when the host
          // configured no endpoint. Gate (localhost bypass + telemetry setting) lives in the wrapper.
          new SpanTransformProcessor({
            exporter: new GatedSpanExporter({
              make: () =>
                new O11yRoutingExporter({
                  makeDefault: o11yEndpoint
                    ? () => new O11ySpanExporter(extensionName, o11yEndpoint, productFeatureId, undefined, falcon)
                    : undefined,
                  makeLegacy: (endpoint, legacyProductFeatureId, legacyExtensionName) =>
                    new O11ySpanExporter(
                      legacyExtensionName,
                      endpoint,
                      legacyProductFeatureId,
                      undefined,
                      getLegacyCallerFalcon(legacyExtensionName, falcon)
                    )
                }),
              o11yEndpoint,
              bypassGovernance: process.env.ESBUILD_WEB_LOCAL === '1'
            })
          }),
          ...(getLocalTracesEnabled() ? [new SpanTransformProcessor({ exporter: new OTLPTraceExporter() })] : []),
          ...(getFileTracesEnabled() ? [new SpanTransformProcessor({ exporter: new OtlpFileSpanExporterWeb() })] : [])
        ]
      };
    })
  );
