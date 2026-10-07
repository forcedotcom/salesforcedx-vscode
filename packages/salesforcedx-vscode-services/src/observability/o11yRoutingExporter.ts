/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { isError, isString } from 'effect/Predicate';
import {
  isLegacySpan,
  legacyCallerExtName,
  LEGACY_O11Y_ENABLED_ATTR,
  LEGACY_O11Y_ENDPOINT_ATTR,
  LEGACY_PRODUCT_FEATURE_ID_ATTR
} from './legacyTelemetrySender';

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

type LegacyO11yGroup = {
  endpoint: string;
  productFeatureId: string | undefined;
  extensionName: string;
  spans: ReadableSpan[];
};

/**
 * Splits O11y export by span origin. Legacy spans carry the calling extension's
 * O11y config (stamped by getLegacyTelemetrySender) and route to per-caller
 * delegates; callers without enableO11y + endpoint are dropped, matching the old
 * per-extension O11yReporter initialization. Everything else uses the host delegate
 * when the host configured one (makeDefault omitted = host has no endpoint, rest dropped).
 * Sits inside GatedSpanExporter, so gov + telemetry-setting gates apply once, upstream.
 */
export class O11yRoutingExporter implements SpanExporter {
  private defaultDelegate: SpanExporter | undefined;
  private readonly legacyDelegates = new Map<string, SpanExporter>();

  constructor(
    private readonly options: {
      makeDefault?: () => SpanExporter;
      makeLegacy: (endpoint: string, productFeatureId: string | undefined, extensionName: string) => SpanExporter;
    }
  ) {}

  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    const rest = spans.filter(span => !isLegacySpan(span));
    const groups = new Map<string, LegacyO11yGroup>();
    spans.filter(isLegacySpan).forEach(span => {
      if (span.attributes[LEGACY_O11Y_ENABLED_ATTR] !== 'true') return;
      const endpoint = span.attributes[LEGACY_O11Y_ENDPOINT_ATTR];
      if (!isString(endpoint) || !endpoint) return;
      const productFeatureIdRaw = span.attributes[LEGACY_PRODUCT_FEATURE_ID_ATTR];
      const productFeatureId = isString(productFeatureIdRaw) ? productFeatureIdRaw : undefined;
      const extensionName = legacyCallerExtName(span);
      const key = `${endpoint}::${productFeatureId ?? ''}::${extensionName}`;
      const group = groups.get(key);
      if (group) group.spans.push(span);
      else groups.set(key, { endpoint, productFeatureId, extensionName, spans: [span] });
    });
    const jobs = [...groups.values()].map(group => exportVia(() => this.legacyDelegateFor(group), group.spans));
    const { makeDefault } = this.options;
    if (rest.length > 0 && makeDefault) {
      jobs.push(exportVia(() => (this.defaultDelegate ??= makeDefault()), rest));
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

  private legacyDelegateFor(group: LegacyO11yGroup): SpanExporter {
    const key = `${group.endpoint}::${group.productFeatureId ?? ''}::${group.extensionName}`;
    const cached = this.legacyDelegates.get(key);
    if (cached) return cached;
    const delegate = this.options.makeLegacy(group.endpoint, group.productFeatureId, group.extensionName);
    this.legacyDelegates.set(key, delegate);
    return delegate;
  }
}
