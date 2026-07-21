/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SpanStatusCode } from '@opentelemetry/api';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { O11yService } from '@salesforce/o11y-reporter';
import * as Effect from 'effect/Effect';
import { isError, isString } from 'effect/Predicate';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { ConnectionService } from '../core/connectionService';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { unknownToErrorCause } from '../core/shared';
import { getServicesRuntime, isServicesRuntimeReady } from '../servicesRuntime';
import {
  convertAttributes,
  getExtensionNameAndVersionAttributes,
  isSpanValidForProductionTelemetry,
  spanDuration
} from './spanUtils';

// o11y_schema is ESM-only; load via dynamic import() so it works when this package is required as CJS
const pdpEventSchemaCache: { promise: Promise<Record<string, unknown>> | null } = {
  promise: null
};
const getPdpEventSchema = async (): Promise<Record<string, unknown>> => {
  // @ts-ignore - o11y_schema has no types
  pdpEventSchemaCache.promise ??= import('o11y_schema/sf_pdp').then(m => m.pdpEventSchema);
  return pdpEventSchemaCache.promise;
};
// Run via shared runtime, not Effect.provide(ConnectionService.Default) (rebuilds per call).
// Fails fast if runtime unpublished. MUST NOT retry: SDK layer built before setServicesRuntime runs,
// blocking would deadlock activation. Early spans stay buffered; post-activation autobatch uploads them.
const getConnection = () =>
  Effect.runPromise(
    getServicesRuntime().pipe(
      Effect.flatMap(runtime => Effect.promise(() => runtime.runPromise(ConnectionService.getConnection())))
    )
  );

/** Build the O11y event payload for a span — the exact shape passed to o11yService.logEvent. */
const toEvent = (span: ReadableSpan, identity: { userId?: string; cliId?: string; webUserId?: string }) => ({
  name: span.name,
  success: span.status?.code !== SpanStatusCode.ERROR,
  properties: {
    ...convertAttributes(span.resource.attributes),
    ...getExtensionNameAndVersionAttributes(span.resource.attributes),
    ...convertAttributes(span.attributes),
    traceID: span.spanContext().traceId,
    spanID: span.spanContext().spanId,
    parentID: span.parentSpanContext?.spanId,
    ...(identity.userId ? { userId: identity.userId } : {}),
    ...(identity.cliId ? { cliId: identity.cliId } : {}),
    ...(identity.webUserId ? { webUserId: identity.webUserId } : {})
  },
  measurements: { duration: spanDuration(span) }
});

/**
 * OpenTelemetry span exporter that sends spans to O11y using @salesforce/o11y-reporter.
 * Only exports top-level spans to avoid noise.
 */
export class O11ySpanExporter implements SpanExporter {
  private o11yService: O11yService;
  private initialized = false;
  private initPromise: Promise<void> | undefined;

  constructor(
    private extensionName: string,
    private endpoint: string,
    private productFeatureId?: string,
    // Dev/test only: when set, O11y events are POSTed to `${localIngestionEndpoint}/o11y` (the span
    // file server) instead of uploaded to O11y. Mirrors the App Insights local divert so both
    // pipelines are inspectable locally. The real o11y-reporter upload goes THROUGH the org connection
    // (getConnectionMethod().requestPost), so it can't be diverted by endpoint alone — we short-circuit
    // logEvent here instead. See sdkLayerConfig.resolveLocalIngestionEndpoint.
    private localIngestionEndpoint?: string
  ) {
    this.o11yService = O11yService.getInstance(extensionName);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = (async () => {
      await this.o11yService.initialize(this.extensionName, this.endpoint, getConnection);
      this.o11yService.enableAutoBatching({ flushInterval: 30_000, enableShutdownHook: true });
      this.initialized = true;
    })();
    return this.initPromise;
  }

  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    // Dev/test local divert: POST the same event payloads to the span file server's /o11y route instead
    // of uploading through the org connection. Skips ensureInitialized() (which needs the connection).
    if (this.localIngestionEndpoint) {
      void this.exportLocal(spans, resultCallback);
      return;
    }
    void Effect.runPromise(
      Effect.tryPromise({
        try: async () => {
          await this.ensureInitialized();
          const pdpEventSchema = await getPdpEventSchema();
          const { userId, cliId, webUserId, orgId, devHubOrgId } = getDefaultOrgRef().pipe(
            Effect.flatMap(ref => SubscriptionRef.get(ref)),
            Effect.runSync
          );
          spans.filter(isSpanValidForProductionTelemetry).forEach(span => {
            const { success, properties: props, measurements } = toEvent(span, { userId, cliId, webUserId });

            if (success) {
              this.o11yService.logEvent({
                name: span.name,
                properties: props,
                measurements
              });
            } else {
              const error = new Error(span.status.message ?? 'Span failed');
              error.name = span.name;
              this.o11yService.logEvent({
                exception: error,
                properties: props,
                measurements
              });
            }

            // PFT for new extensions
            if (this.productFeatureId && isString(span.attributes['command'])) {
              this.o11yService.logEventWithSchema(
                {
                  eventName: 'vscodeExtension.executed',
                  productFeatureId: this.productFeatureId,
                  contextName: 'orgId::devhubId',
                  contextValue: `${orgId}::${devHubOrgId}`,
                  componentId: `${props['common.extname']}.${span.attributes['command']}`
                },
                pdpEventSchema
              );
            }
          });
          resultCallback({ code: ExportResultCode.SUCCESS });
        },
        catch: err => unknownToErrorCause(err)
      }).pipe(
        Effect.catchAll(err => {
          console.error('O11ySpanExporter export failed:', err.cause);
          return Effect.sync(() => {
            resultCallback({
              code: ExportResultCode.FAILED,
              error: err.cause
            });
          });
        })
      )
    );
  }

  /** Dev/test: POST valid spans' O11y event payloads to the span file server's /o11y route. */
  private async exportLocal(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): Promise<void> {
    const valid = spans.filter(isSpanValidForProductionTelemetry);
    if (valid.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }
    // Identity may be unavailable pre-runtime; default to empty rather than throwing (diagnostic sink).
    const identity = isServicesRuntimeReady()
      ? getDefaultOrgRef().pipe(Effect.flatMap(SubscriptionRef.get), Effect.runSync)
      : {};
    const events = valid.map(span => toEvent(span, identity));
    // eslint-disable-next-line functional/no-try-statements -- network boundary
    try {
      const res = await fetch(`${this.localIngestionEndpoint!.replace(/\/$/, '')}/o11y`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionName: this.extensionName, events })
      });
      resultCallback(
        res.ok
          ? { code: ExportResultCode.SUCCESS }
          : { code: ExportResultCode.FAILED, error: new Error(`local /o11y responded ${res.status}`) }
      );
    } catch (error) {
      console.error('O11ySpanExporter local divert failed:', error);
      resultCallback({
        code: ExportResultCode.FAILED,
        error: isError(error) ? error : new Error(String(error))
      });
    }
  }

  public shutdown(): Promise<void> {
    // In local-divert mode nothing is buffered in o11yService (we POST directly), so no flush needed.
    if (this.localIngestionEndpoint) {
      return Promise.resolve();
    }
    // forceFlush drains buffer at read time; if runtime unpublished, drained spans lost.
    // On web, this fires before setServicesRuntime runs. Skip flush until runtime ready;
    // post-activation autobatch uploads buffered spans then.
    return isServicesRuntimeReady() ? this.o11yService.forceFlush() : Promise.resolve();
  }
}
