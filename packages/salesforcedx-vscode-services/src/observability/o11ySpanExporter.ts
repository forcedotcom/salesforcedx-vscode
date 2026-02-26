/*
 * Copyright (c) 2025, salesforce.com, inc.
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
import { convertAttributes, getExtensionNameAndVersionAttributes, isTopLevelSpan, spanDuration } from './spanUtils';

// o11y_schema is ESM-only; load via dynamic import() so it works when this package is required as CJS
let pdpEventSchemaPromise: Promise<Record<string, unknown>> | null = null;
async function getPdpEventSchema(): Promise<Record<string, unknown>> {
  if (!pdpEventSchemaPromise) {
    // @ts-ignore o11y_schema has no types
    pdpEventSchemaPromise = import('o11y_schema/sf_pdp').then(
      (m) => m.pdpEventSchema as Record<string, unknown>
    );
  }
  return pdpEventSchemaPromise;
}
const getConnection = () =>
  Effect.runPromise(
    ConnectionService.getConnection().pipe(Effect.provide(ConnectionService.Default))
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
          const { cliId, webUserId, orgId, devHubOrgId } = getDefaultOrgRef().pipe(
            Effect.flatMap(ref => SubscriptionRef.get(ref)),
            Effect.runSync
          );
          spans.filter(isTopLevelSpan).forEach(span => {
            const success = span.status?.code !== SpanStatusCode.ERROR;
            const props = {
              ...convertAttributes(span.resource.attributes),
              ...getExtensionNameAndVersionAttributes(span.resource.attributes),
              ...convertAttributes(span.attributes),
              traceID: span.spanContext().traceId,
              spanID: span.spanContext().spanId,
              parentID: span.parentSpanContext?.spanId,
              ...(cliId ? { userId: cliId } : {}),
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
    return this.o11yService.forceFlush();
  }
}
