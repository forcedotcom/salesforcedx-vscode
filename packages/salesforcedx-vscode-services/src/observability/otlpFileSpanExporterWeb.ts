/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import * as HttpClient from '@effect/platform/HttpClient';
import * as HttpClientRequest from '@effect/platform/HttpClientRequest';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import * as Effect from 'effect/Effect';
import { runOnServicesRuntime } from './redactingConsoleLogger';
import { serializeSpanOtlp } from './spanUtils';

const OTLP_SPAN_FILE_SERVER_URL = 'http://localhost:3003/otlp-spans';

const serverUnreachable = { logged: false };

/** Span exporter that POSTs normalized OTLP span lines to local span file server (port 3003). */
export class OtlpFileSpanExporterWeb implements SpanExporter {
  // eslint-disable-next-line class-methods-use-this -- SpanExporter interface
  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (spans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    const lines = spans.map(span => serializeSpanOtlp(span));

    void HttpClient.execute(
      HttpClientRequest.post(OTLP_SPAN_FILE_SERVER_URL).pipe(
        HttpClientRequest.bodyText(JSON.stringify({ lines }), 'application/json')
      )
    ).pipe(
      Effect.map(res =>
        res.status >= 200 && res.status < 300
          ? resultCallback({ code: ExportResultCode.SUCCESS })
          : resultCallback({ code: ExportResultCode.FAILED, error: new Error(`HTTP ${res.status}`) })
      ),
      Effect.catchAll(error => {
        if (!serverUnreachable.logged) {
          serverUnreachable.logged = true;
          return Effect.logWarning(
            'Span file server unreachable at localhost:3003 — enableFileTraces needs spans:server running'
          ).pipe(
            runOnServicesRuntime,
            Effect.andThen(Effect.sync(() => resultCallback({ code: ExportResultCode.FAILED, error })))
          );
        }
        return Effect.sync(() => resultCallback({ code: ExportResultCode.FAILED, error }));
      }),
      Effect.withTracerEnabled(false),
      Effect.provide(FetchHttpClient.layer),
      Effect.runPromise
    );
  }

  // eslint-disable-next-line class-methods-use-this -- SpanExporter interface requires shutdown
  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
