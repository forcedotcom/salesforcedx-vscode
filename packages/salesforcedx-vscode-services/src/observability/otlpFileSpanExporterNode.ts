/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-restricted-imports -- Node-only exporter, not used in web bundle */
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { Global } from '@salesforce/core/global';
import { appendFileSync, mkdirSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { serializeSpanOtlp } from './spanUtils';

const SPANS_DIR = join(Global.SF_DIR, 'vscode-spans');

// eslint-disable-next-line functional/no-let -- lazily initialized shared path
let sharedFilePath: string | undefined;

const getFilePath = (): string => {
  if (!sharedFilePath) {
    mkdirSync(SPANS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    sharedFilePath = join(SPANS_DIR, `otlp-${timestamp}.jsonl`);
  }
  return sharedFilePath;
};

/** Span exporter that writes normalized OTLP spans (one per line) to ~/.sf/vscode-spans/otlp-{timestamp}.jsonl */
export class OtlpFileSpanExporterNode implements SpanExporter {
  private readonly env = { hostname: hostname(), processId: String(process.pid) };

  // eslint-disable-next-line class-methods-use-this -- SpanExporter interface
  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (spans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    const result: ExportResult = (() => {
      // eslint-disable-next-line functional/no-try-statements -- sync fs op, no Effect in exporter
      try {
        const lines = spans.map(span => serializeSpanOtlp(span, this.env)).join('\n');
        appendFileSync(getFilePath(), `${lines}\n`);
        return { code: ExportResultCode.SUCCESS };
      } catch (error) {
        return { code: ExportResultCode.FAILED, error };
      }
    })();
    resultCallback(result);
  }

  // eslint-disable-next-line class-methods-use-this -- SpanExporter interface requires shutdown
  public shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
