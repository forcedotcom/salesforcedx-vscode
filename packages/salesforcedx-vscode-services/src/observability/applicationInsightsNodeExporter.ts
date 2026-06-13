/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Node platform OpenTelemetry span exporter that routes spans to the App Insights
 * customEvents table using the OTEL Logs API with the microsoft.custom_event.name attribute.
 *
 * Per Microsoft docs:
 * https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-add-modify?tabs=nodejs#send-custom-events
 *
 * Setting the "microsoft.custom_event.name" attribute on a LogRecord causes the Azure Monitor
 * OTEL exporter to route it to the customEvents table instead of traces/dependencies.
 *
 * This bypasses the global OTEL logs API (which is a no-op until setGlobalLoggerProvider is called)
 * by holding a direct reference to an AzureMonitorLogExporter and a local LoggerProvider.
 */
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { Global } from '@salesforce/core/global';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { join } from 'node:path';
import { workspace } from 'vscode';
import { getDefaultOrgRef } from '../core/defaultOrgRef';
import { AzureMonitorLogExporterWrapper } from './azureMonitorLogExporterWrapper';
import {
  convertAttributes,
  getExtensionNameAndVersionAttributes,
  isSpanValidForProductionTelemetry,
  spanDuration
} from './spanUtils';

const getSpanKindName = (kind: SpanKind): string =>
  Match.value(kind).pipe(
    Match.when(SpanKind.INTERNAL, () => 'INTERNAL'),
    Match.when(SpanKind.SERVER, () => 'SERVER'),
    Match.when(SpanKind.CLIENT, () => 'CLIENT'),
    Match.when(SpanKind.PRODUCER, () => 'PRODUCER'),
    Match.when(SpanKind.CONSUMER, () => 'CONSUMER'),
    Match.orElse(() => 'UNKNOWN')
  );

/**
 * OpenTelemetry span exporter for Node platform that routes spans to the App Insights
 * customEvents table by emitting OTEL LogRecords with "microsoft.custom_event.name".
 *
 * Owns a private LoggerProvider wired directly to AzureMonitorLogExporter so it does not
 * depend on the global OTEL log provider (which @effect/opentelemetry does not register).
 */
export class ApplicationInsightsNodeExporter implements SpanExporter {
  private loggerProvider: LoggerProvider;
  private otelLogger: ReturnType<LoggerProvider['getLogger']>;

  constructor(connectionString: string, localIngestionEndpoint?: string) {
    this.loggerProvider = new LoggerProvider({
      processors: [
        new SimpleLogRecordProcessor(
          new AzureMonitorLogExporterWrapper(
            {
              connectionString,
              storageDirectory: join(Global.SF_DIR, 'vscode-extensions-telemetry')
            },
            localIngestionEndpoint
          )
        )
      ]
    });
    this.otelLogger = this.loggerProvider.getLogger('salesforce-vscode-customevents', '1.0.0');
  }

  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    const validSpans = spans.filter(isSpanValidForProductionTelemetry);

    if (validSpans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    const otelLogger = this.otelLogger;

    void Effect.runPromise(
      Effect.all(validSpans.map(span => sendSpan(span, otelLogger))).pipe(
        Effect.map(() => {
          resultCallback({ code: ExportResultCode.SUCCESS });
        }),
        Effect.catchAll(error => {
          console.error('ApplicationInsightsNodeExporter export failed:', error);
          return Effect.sync(() => {
            resultCallback({ code: ExportResultCode.FAILED });
          });
        })
      )
    );
  }

  public shutdown(): Promise<void> {
    return this.loggerProvider.shutdown();
  }
}

const sendSpan = (span: ReadableSpan, otelLogger: ReturnType<LoggerProvider['getLogger']>) =>
  Effect.gen(function* () {
    const telemetryTag = workspace.getConfiguration()?.get<string>('salesforcedx-vscode-core.telemetry-tag');

    const orgRefResult = yield* Effect.gen(function* () {
      const orgRef = yield* getDefaultOrgRef();
      return yield* SubscriptionRef.get(orgRef);
    }).pipe(Effect.catchAll(() => Effect.succeed({ userId: undefined, webUserId: undefined })));

    const { userId, webUserId } = orgRefResult;

    const isError = span.status?.code === SpanStatusCode.ERROR;

    // Emit a LogRecord — the "microsoft.custom_event.name" attribute tells Azure Monitor
    // to route this to the customEvents table instead of traces.
    otelLogger.emit({
      // SeverityNumber.ERROR (17) / SeverityNumber.INFO (9) — hard-coded to avoid a runtime
      // dependency on @opentelemetry/api-logs just for these enum values.
      // https://github.com/open-telemetry/opentelemetry-js/blob/main/api/src/logs/LogRecord.ts
      severityNumber: isError ? 17 : 9,
      severityText: isError ? 'ERROR' : 'INFO',
      body: span.name,
      attributes: {
        // Magic attribute: routes this LogRecord to the customEvents table
        'microsoft.custom_event.name': span.name,

        // Resource attributes (extension name/version)
        ...convertAttributes(span.resource.attributes),
        ...getExtensionNameAndVersionAttributes(span.resource.attributes),
        // Span attributes
        ...convertAttributes(span.attributes),
        // Trace context
        traceID: span.spanContext().traceId,
        spanID: span.spanContext().spanId,
        ...(span.parentSpanContext?.spanId ? { parentID: span.parentSpanContext.spanId } : {}),
        // Span metadata
        spanKind: getSpanKindName(span.kind),
        spanStatus: isError ? 'ERROR' : 'OK',
        // Timestamps
        startTime: String(span.startTime[0] * 1000 + span.startTime[1] / 1_000_000),
        endTime: String(span.endTime[0] * 1000 + span.endTime[1] / 1_000_000),
        // Duration as a measurement
        duration: spanDuration(span),
        // User context
        ...(userId ? { userId } : {}),
        ...(webUserId ? { webUserId } : {}),
        // Telemetry tag
        ...(telemetryTag ? { telemetryTag } : {})
      },
      timestamp: span.startTime
    });
  });
