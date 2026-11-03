/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as WebSdk from '@effect/opentelemetry/WebSdk';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-web';
import type { SdkLayerConfig } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as OtlpExporter from 'effect/observability/OtlpExporter';
import { ApplicationInsightsWebExporter } from './applicationInsightsWebExporter';
import { flushProcessors } from './flushProcessors';
import { GatedSpanExporter } from './gatedSpanExporter';
import { getConsoleTracesEnabled, getLocalTracesEnabled, getFileTracesEnabled } from './localTracing';
import { O11yRoutingExporter } from './o11yRoutingExporter';
import { O11ySpanExporter } from './o11ySpanExporter';
import { OtlpFileSpanExporterWeb } from './otlpFileSpanExporterWeb';
import { RedactingSpanProcessor } from './redactingSpanProcessor';
import { SpanTransformProcessor, spanIdentitySnapshot } from './spanTransformProcessor';

export const WebSdkLayerFor = ({ extensionName, extensionVersion, o11yEndpoint, productFeatureId }: SdkLayerConfig) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const getIdentitySnapshot = yield* spanIdentitySnapshot;
      const flusher = yield* OtlpExporter.Flusher;
      const config = {
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
        loggerMergeWithExisting: true,
        spanProcessor: [
          // first and unconditional: rewrites sensitive-data-shaped text during onEnding, which MultiSpanProcessor
          // runs on every processor before any onEnd, so every sink below receives redacted spans
          new RedactingSpanProcessor(),
          ...(getConsoleTracesEnabled()
            ? [new SpanTransformProcessor({ exporter: new ConsoleSpanExporter(), getIdentitySnapshot })]
            : []),
          // AI processor always present; GatedSpanExporter re-checks the telemetry setting per export (mid-session toggle)
          new SpanTransformProcessor({
            getIdentitySnapshot,
            exporter: new GatedSpanExporter({
              make: () => new ApplicationInsightsWebExporter(),
              bypassGovernance: process.env.ESBUILD_WEB_LOCAL === '1'
            })
          }),
          // O11y processor always present; O11yRoutingExporter restores per-caller
          // endpoint/PFT for legacy spans and drops rest spans when the host
          // configured no endpoint. Gate (localhost bypass + telemetry setting) lives in the wrapper.
          new SpanTransformProcessor({
            getIdentitySnapshot,
            exporter: new GatedSpanExporter({
              make: () =>
                new O11yRoutingExporter({
                  makeDefault: o11yEndpoint
                    ? () => new O11ySpanExporter(extensionName, o11yEndpoint, productFeatureId)
                    : undefined,
                  makeLegacy: (endpoint, legacyProductFeatureId, legacyExtensionName) =>
                    new O11ySpanExporter(legacyExtensionName, endpoint, legacyProductFeatureId)
                }),
              o11yEndpoint,
              bypassGovernance: process.env.ESBUILD_WEB_LOCAL === '1'
            })
          }),
          ...(getLocalTracesEnabled()
            ? [new SpanTransformProcessor({ exporter: new OTLPTraceExporter(), getIdentitySnapshot })]
            : []),
          ...(getFileTracesEnabled()
            ? [new SpanTransformProcessor({ exporter: new OtlpFileSpanExporterWeb(), getIdentitySnapshot })]
            : [])
        ]
      };
      return WebSdk.layer(() => config).pipe(
        Layer.provideMerge(
          Layer.effectDiscard(
            flusher.register(
              Effect.promise(async () => {
                await flushProcessors(config.spanProcessor);
              })
            )
          )
        )
      );
    })
  ).pipe(Layer.provideMerge(OtlpExporter.layerFlusher));
