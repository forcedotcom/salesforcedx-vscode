/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
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

    fetch(OTLP_SPAN_FILE_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines })
    })
      .then(res =>
        res.ok
          ? resultCallback({ code: ExportResultCode.SUCCESS })
          : resultCallback({ code: ExportResultCode.FAILED, error: new Error(`HTTP ${res.status}`) })
      )
      .catch(error => {
        if (!serverUnreachable.logged) {
          console.warn(
            'Span file server unreachable at localhost:3003 — enableOtlpFileTraces needs spans:server running'
          );
          serverUnreachable.logged = true;
        }
        resultCallback({ code: ExportResultCode.FAILED, error });
      });
  }

  // eslint-disable-next-line class-methods-use-this -- SpanExporter interface requires shutdown
  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
