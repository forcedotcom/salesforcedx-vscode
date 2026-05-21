/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { type Context, TraceFlags } from '@opentelemetry/api';
import type { LogRecordProcessor, SdkLogRecord } from '@opentelemetry/sdk-logs';

/**
 * Processor shim that copies traceId/spanId from log attributes into the
 * spanContext field when @effect/opentelemetry's Logger places them there
 * instead of setting the proper OTEL span context. This enables Grafana/Loki
 * trace-to-logs correlation over OTLP.
 */
export class TraceContextLogProcessor implements LogRecordProcessor {
  constructor(private readonly wrapped: LogRecordProcessor) {}

  public onEmit(logRecord: SdkLogRecord, context?: Context): void {
    if (!logRecord.spanContext) {
      const traceId = logRecord.attributes['traceId'];
      const spanId = logRecord.attributes['spanId'];
      if (typeof traceId === 'string' && traceId && typeof spanId === 'string' && spanId) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- spanContext is writable at runtime on LogRecordImpl
        (logRecord as unknown as { spanContext: unknown }).spanContext = {
          traceId,
          spanId,
          traceFlags: TraceFlags.SAMPLED
        };
      }
    }
    this.wrapped.onEmit(logRecord, context);
  }

  public forceFlush(): Promise<void> {
    return this.wrapped.forceFlush();
  }

  public shutdown(): Promise<void> {
    return this.wrapped.shutdown();
  }
}
