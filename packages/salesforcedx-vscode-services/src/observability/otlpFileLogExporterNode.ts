/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-restricted-imports -- Node-only exporter, not used in web bundle */
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import type { LogRecordExporter, ReadableLogRecord } from '@opentelemetry/sdk-logs';
import { appendFileSync } from 'node:fs';
import { getOtlpFilePath } from './otlpFileSpanExporterNode';

const hrTimeToNano = (hrTime: [number, number]): string =>
  (BigInt(hrTime[0]) * 1_000_000_000n + BigInt(hrTime[1])).toString();

const serializeLogRecord = (log: ReadableLogRecord): string => {
  const traceId = log.spanContext?.traceId ?? String(log.attributes['traceId'] ?? '');
  const spanId = log.spanContext?.spanId ?? String(log.attributes['spanId'] ?? '');
  return JSON.stringify({
    kind: 'log',
    timestamp: hrTimeToNano(log.hrTime),
    severityText: log.severityText ?? 'UNSPECIFIED',
    severityNumber: log.severityNumber,
    body: log.body,
    traceId,
    spanId,
    attributes: log.attributes
  });
};

/** Log record exporter that appends to the same OTLP JSONL file as spans (~/.sf/vscode-spans/otlp-{timestamp}.jsonl) */
export class OtlpFileLogExporterNode implements LogRecordExporter {
  // eslint-disable-next-line class-methods-use-this -- LogRecordExporter interface
  public export(logs: ReadableLogRecord[], resultCallback: (result: ExportResult) => void): void {
    if (logs.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    const result: ExportResult = (() => {
      // eslint-disable-next-line functional/no-try-statements -- sync fs op, no Effect in exporter
      try {
        const lines = logs.map(serializeLogRecord).join('\n');
        appendFileSync(getOtlpFilePath(), `${lines}\n`);
        return { code: ExportResultCode.SUCCESS };
      } catch (error) {
        return { code: ExportResultCode.FAILED, error };
      }
    })();
    resultCallback(result);
  }

  // eslint-disable-next-line class-methods-use-this -- LogRecordExporter interface requires shutdown
  public shutdown(): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line class-methods-use-this -- LogRecordExporter interface requires forceFlush
  public forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}
