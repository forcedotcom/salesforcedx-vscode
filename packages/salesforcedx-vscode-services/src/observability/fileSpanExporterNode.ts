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
import { join } from 'node:path';
import { serializeSpanForFile } from './spanUtils';

const SPANS_DIR = join(Global.SF_DIR, 'vscode-spans');

/** Span exporter that appends simplified JSON lines to ~/.sf/vscode-spans/node-{extensionName}-{timestamp}.jsonl */
export class FileSpanExporterNode implements SpanExporter {
  private readonly filePath: string;

  constructor(extensionName: string) {
    mkdirSync(SPANS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    this.filePath = join(SPANS_DIR, `node-${extensionName}-${timestamp}.jsonl`);
  }

  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    const lines = spans.map(serializeSpanForFile).join('\n') + (spans.length > 0 ? '\n' : '');
    if (!lines) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }
    const result: ExportResult = (() => {
      // eslint-disable-next-line functional/no-try-statements -- sync fs op, no Effect in exporter
      try {
        appendFileSync(this.filePath, lines);
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
