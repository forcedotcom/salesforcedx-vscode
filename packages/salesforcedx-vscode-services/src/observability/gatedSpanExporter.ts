/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { isProductionTelemetryExportEnabled } from './spanUtils';

/**
 * Wraps a real SpanExporter with a per-export telemetry gate. The gate is re-checked
 * on every export batch so toggling `telemetry.enabled` mid-session takes effect without
 * a reload. The delegate exporter is constructed lazily on the first enabled export and
 * cached, so a telemetry-disabled session never runs the delegate ctor (avoids Azure
 * Statsbeat / network setup that some exporter ctors trigger).
 */
export class GatedSpanExporter implements SpanExporter {
  private delegate: SpanExporter | undefined;

  constructor(
    private readonly make: () => SpanExporter,
    private readonly o11yEndpoint?: string
  ) {}

  public export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (!isProductionTelemetryExportEnabled(this.o11yEndpoint)) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }
    (this.delegate ??= this.make()).export(spans, resultCallback);
  }

  public shutdown(): Promise<void> {
    return this.delegate?.shutdown() ?? Promise.resolve();
  }
}
