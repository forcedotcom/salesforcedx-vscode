/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AzureMonitorLogExporter, type AzureMonitorExporterOptions } from '@azure/monitor-opentelemetry-exporter';
import type { ExportResult } from '@opentelemetry/core';
import type { LogRecordExporter, ReadableLogRecord } from '@opentelemetry/sdk-logs';
import { makeLocalEnvelopeSender } from './localEnvelopeSender';

/**
 * Wrapper for AzureMonitorLogExporter that implements the full LogRecordExporter interface.
 *
 * The Azure Monitor exporter only implements shutdown() but OTEL SDK requires forceFlush().
 * This wrapper adds the missing method by delegating to the underlying exporter's private sender.
 *
 * When localIngestionEndpoint is set (dev/test), the underlying exporter's private sender is swapped
 * so the customEvent envelopes POST to the local span file server over plain HTTP instead of Azure
 * (see localEnvelopeSender for why a connection-string rewrite cannot do this).
 */
export class AzureMonitorLogExporterWrapper implements LogRecordExporter {
  private exporter: AzureMonitorLogExporter;

  constructor(options: AzureMonitorExporterOptions, localIngestionEndpoint?: string) {
    this.exporter = new AzureMonitorLogExporter(options);
    if (localIngestionEndpoint) {
      // @ts-expect-error -- `_sender` is a private SDK field; intentionally overriding the transport.
      this.exporter._sender = makeLocalEnvelopeSender(localIngestionEndpoint);
    }
  }

  public export(logs: ReadableLogRecord[], resultCallback: (result: ExportResult) => void): void {
    void this.exporter.export(logs, resultCallback);
  }

  public async shutdown(): Promise<void> {
    return this.exporter.shutdown();
  }

  // eslint-disable-next-line class-methods-use-this
  public async forceFlush(): Promise<void> {
    // AzureMonitorLogExporter doesn't expose forceFlush, but we can resolve immediately
    // since the exporter batches internally. The shutdown() method ensures all pending
    // data is flushed, which is called during extension deactivation.
  }
}
