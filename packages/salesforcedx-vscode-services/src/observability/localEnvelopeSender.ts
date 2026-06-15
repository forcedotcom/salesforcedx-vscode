/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Dev/test transport that POSTs Azure Monitor Breeze envelopes to a local HTTP server
 * (the span file server's /v2.1/track handler) instead of Azure.
 *
 * The Azure SDK exporters build envelopes then hand them to a private `sender.exportEnvelopes()`.
 * We replace that sender with this one so the envelopes are diverted locally. A direct
 * IngestionEndpoint rewrite does not work: ConnectionStringParser.sanitizeUrl force-upgrades
 * http://→https:// (node_modules/@azure/monitor-opentelemetry-exporter), making a plain-HTTP
 * local server unreachable.
 */
import { ExportResultCode, type ExportResult } from '@opentelemetry/core';

/** Matches the private sender shape the Azure exporters call (trace: `sender`, log: `_sender`). */
export type LocalEnvelopeSender = {
  exportEnvelopes: (envelopes: unknown[]) => Promise<ExportResult>;
  shutdown: () => Promise<void>;
};

export const makeLocalEnvelopeSender = (localEndpoint: string): LocalEnvelopeSender => {
  const trackUrl = `${localEndpoint.replace(/\/$/, '')}/v2.1/track`;
  return {
    exportEnvelopes: async (envelopes: unknown[]): Promise<ExportResult> => {
      // eslint-disable-next-line functional/no-try-statements -- network boundary
      try {
        await fetch(trackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-json-stream' },
          body: envelopes.map(e => JSON.stringify(e)).join('\n')
        });
        return { code: ExportResultCode.SUCCESS };
      } catch (error) {
        return { code: ExportResultCode.FAILED, error: error instanceof Error ? error : new Error(String(error)) };
      }
    },
    shutdown: () => Promise.resolve()
  };
};
