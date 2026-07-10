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
// Run through the shared services runtime (not Effect.provide(ConnectionService.Default), which would
// build a private ConnectionService per call — separate connection/reauth caches, defeating dedup).
// Fails fast with ServicesRuntimeNotReady if the runtime isn't published yet. Do NOT retry-until-ready:
// on web the SDK layer is built inside the awaited fileSystemSetup (index.ts), before setServicesRuntime
// runs, so a getConnection that blocks waiting on the runtime deadlocks activation. Early spans aren't
// lost — shutdown() below skips the buffer-draining flush until the runtime exists, so they stay buffered
// on the shared O11yService singleton and upload on the next autobatch tick once getConnection works.
const getConnection = () =>
  Effect.runPromise(
    getServicesRuntime().pipe(
      Effect.flatMap(runtime => Effect.promise(() => runtime.runPromise(ConnectionService.getConnection())))
    )
  );

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
    private productFeatureId?: string
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
            const success = span.status?.code !== SpanStatusCode.ERROR;
            const props = {
              ...convertAttributes(span.resource.attributes),
              ...getExtensionNameAndVersionAttributes(span.resource.attributes),
              ...convertAttributes(span.attributes),
              traceID: span.spanContext().traceId,
              spanID: span.spanContext().spanId,
              parentID: span.parentSpanContext?.spanId,
              ...(userId ? { userId } : {}),
              ...(cliId ? { cliId } : {}),
              ...(webUserId ? { webUserId } : {})
            };
            const measurements = {
              duration: spanDuration(span)
            };

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
            if (this.productFeatureId && typeof span.attributes['command'] === 'string') {
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

  public shutdown(): Promise<void> {
    // forceFlush drains the shared o11y buffer AT READ TIME (getRawContentsOfCoreEnvelope →
    // getAllMessages(true) empties it), then uploads. If the services runtime isn't published yet, the
    // upload's getConnection fails and the drained spans are lost with no re-buffer. This shutdown fires
    // on web when the SDK layer built inside the awaited fileSystemSetup (index.ts) closes its scope —
    // strictly BEFORE setServicesRuntime runs. Skip the flush in that window: the spans stay buffered on
    // the shared O11yService singleton and the post-activation autobatch timer uploads them once the
    // runtime exists. Only force-flush when the runtime is ready (real deactivation / later scope closes).
    return isServicesRuntimeReady() ? this.o11yService.forceFlush() : Promise.resolve();
  }
}
