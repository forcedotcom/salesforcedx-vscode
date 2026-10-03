/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { isError } from 'effect/Predicate';
import * as vscode from 'vscode';
import { isLegacySpan, legacyCallerExtName, resolveLegacyConnectionString } from './legacyTelemetrySender';

const packageJSONFor = (extName: string): { otelConnectionString?: string; aiKey?: string } | undefined => {
  // eslint-disable-next-line functional/no-try-statements -- vscode host boundary
  try {
    return vscode.extensions.all?.find(extension => extension.packageJSON?.name === extName)?.packageJSON;
  } catch {
    return undefined;
  }
};

const exportVia = (make: () => SpanExporter, spans: ReadableSpan[]): Promise<ExportResult> => {
  // eslint-disable-next-line functional/no-try-statements -- exporter boundary
  try {
    const delegate = make();
    return new Promise(resolve => {
      // eslint-disable-next-line functional/no-try-statements -- exporter boundary
      try {
        delegate.export(spans, resolve);
      } catch (error) {
        resolve({ code: ExportResultCode.FAILED, error: isError(error) ? error : new Error(String(error)) });
      }
    });
  } catch (error) {
    return Promise.resolve({
      code: ExportResultCode.FAILED,
      error: isError(error) ? error : new Error(String(error))
    });
  }
};

/**
 * Splits AI export by span origin. Legacy spans carry per-caller keys resolved
 * from the host extension's packageJSON; everything else uses the layer delegate.
 * Sits inside GatedSpanExporter, so gov + telemetry-setting gates apply once, upstream.
 */
export class AppInsightsRoutingExporter implements SpanExporter {
  private defaultDelegate: SpanExporter | undefined;
  private readonly legacyDelegates = new Map<string, SpanExporter>();

  constructor(
    private readonly options: {
      makeDefault: () => SpanExporter;
      makeLegacy: (connectionString: string) => SpanExporter;
    }
  ) {}

  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    const rest = spans.filter(span => !isLegacySpan(span));
    const groups = new Map<string, ReadableSpan[]>();
    spans.filter(isLegacySpan).forEach(span => {
      const key = resolveLegacyConnectionString(packageJSONFor(legacyCallerExtName(span)));
      const group = groups.get(key);
      if (group) group.push(span);
      else groups.set(key, [span]);
    });
    const jobs = [...groups.entries()].map(([connectionString, group]) =>
      exportVia(() => this.legacyDelegateFor(connectionString), group)
    );
    if (rest.length > 0) {
      jobs.push(exportVia(() => (this.defaultDelegate ??= this.options.makeDefault()), rest));
    }
    void Promise.all(jobs).then(results => {
      resultCallback(
        results.find(result => result.code !== ExportResultCode.SUCCESS) ?? { code: ExportResultCode.SUCCESS }
      );
    });
  }

  public async forceFlush(): Promise<void> {
    await Promise.allSettled(
      [this.defaultDelegate?.forceFlush?.()].concat(
        [...this.legacyDelegates.values()].map(delegate => delegate.forceFlush?.())
      )
    );
  }

  public async shutdown(): Promise<void> {
    await Promise.allSettled(
      [this.defaultDelegate?.shutdown()].concat([...this.legacyDelegates.values()].map(delegate => delegate.shutdown()))
    );
  }

  private legacyDelegateFor(connectionString: string): SpanExporter {
    const cached = this.legacyDelegates.get(connectionString);
    if (cached) return cached;
    const delegate = this.options.makeLegacy(connectionString);
    this.legacyDelegates.set(connectionString, delegate);
    return delegate;
  }
}
