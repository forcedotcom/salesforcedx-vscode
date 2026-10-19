/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as HttpClient from '@effect/platform/HttpClient';
import * as HttpClientRequest from '@effect/platform/HttpClientRequest';
import { type ExportResult, ExportResultCode } from '@opentelemetry/core';
import { type ReadableSpan, type SpanExporter } from '@opentelemetry/sdk-trace-base';
import * as Effect from 'effect/Effect';
import { isError } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { exportResultFromHttpStatus } from './httpExportResult';
import { makeLocalHttpRuntime } from './localHttpRuntime';
import { runOnServicesRuntime } from './redactingConsoleLogger';
import { serializeSpanOtlp } from './spanUtils';

const OTLP_SPAN_FILE_SERVER_URL = 'http://localhost:3003/otlp-spans';

const localExportFailureLogged = { logged: false };

class OtlpSpanSerializationError extends Schema.TaggedError<OtlpSpanSerializationError>()(
  'OtlpSpanSerializationError',
  { message: Schema.String, cause: Schema.Unknown }
) {}

/** Span exporter that POSTs normalized OTLP span lines to local span file server (port 3003). */
export class OtlpFileSpanExporterWeb implements SpanExporter {
  private readonly localHttpRuntime = makeLocalHttpRuntime();

  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (spans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    void this.localHttpRuntime.runPromise(
      Effect.try({
        try: () => spans.map(span => serializeSpanOtlp(span)),
        catch: cause =>
          new OtlpSpanSerializationError({
            message: 'Failed to serialize local OTLP spans',
            cause
          })
      }).pipe(
        Effect.flatMap(lines =>
          HttpClientRequest.post(OTLP_SPAN_FILE_SERVER_URL).pipe(
            HttpClientRequest.bodyJson({ lines }),
            Effect.flatMap(HttpClient.execute)
          )
        ),
        Effect.map(res => resultCallback(exportResultFromHttpStatus(res.status, status => `HTTP ${status}`))),
        Effect.catchAll(error => {
          const exportError = isError(error) ? error : new Error(String(error));
          if (!localExportFailureLogged.logged) {
            localExportFailureLogged.logged = true;
            return Effect.logWarning(
              'Local span export failed at localhost:3003 — check spans:server and span payloads'
            ).pipe(
              runOnServicesRuntime,
              Effect.andThen(Effect.sync(() => resultCallback({ code: ExportResultCode.FAILED, error: exportError })))
            );
          }
          return Effect.sync(() => resultCallback({ code: ExportResultCode.FAILED, error: exportError }));
        }),
        Effect.withTracerEnabled(false)
      )
    );
  }

  public shutdown(): Promise<void> {
    return this.localHttpRuntime.dispose();
  }
}
