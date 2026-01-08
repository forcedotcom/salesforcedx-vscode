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
import { unknownToErrorCause } from '../core/shared';
import { convertAttributes, getExtensionNameAndVersionAttributes, isTopLevelSpan, spanDuration } from './spanUtils';

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
    private endpoint: string
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
      await this.o11yService.initialize(this.extensionName, this.endpoint);
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
          spans.filter(isTopLevelSpan).forEach(span => {
            const success = !span.status || span.status.code !== SpanStatusCode.ERROR;
            const props = {
              ...convertAttributes(span.resource.attributes),
              ...getExtensionNameAndVersionAttributes(span.resource.attributes),
              ...convertAttributes(span.attributes),
              traceID: span.spanContext().traceId,
              spanID: span.spanContext().spanId,
              parentID: span.parentSpanContext?.spanId
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
