/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { getSpanCreationIdentity } from './spanTransformProcessor';
import { isSpanValidForProductionTelemetry } from './spanUtils';

/**
 * Wraps a real SpanExporter with a per-export gate. The `isEnabled` predicate is re-checked
 * on every export batch so toggling `telemetry.enabled` mid-session takes effect without
 * a reload. The delegate exporter is constructed lazily on the first enabled export and
 * cached, so a disabled session never runs the delegate ctor (avoids Azure
 * Statsbeat / network setup that some exporter ctors trigger).
 */
export class GatedSpanExporter implements SpanExporter {
  private delegate: SpanExporter | undefined;

  constructor(
    private readonly options: {
      make: () => SpanExporter;
      isEnabled: () => boolean;
      bypassGovernance?: boolean;
    }
  ) {}

  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (!this.options.isEnabled()) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }
    const eligible = spans.filter(
      span =>
        isSpanValidForProductionTelemetry(span) &&
        (this.options.bypassGovernance ?? getSpanCreationIdentity(span).telemetryClassification === 'nonGov')
    );
    if (eligible.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }
    (this.delegate ??= this.options.make()).export(eligible, resultCallback);
  }

  public async forceFlush(): Promise<void> {
    await this.delegate?.forceFlush?.();
  }

  public async shutdown(): Promise<void> {
    await this.delegate?.shutdown();
  }
}
