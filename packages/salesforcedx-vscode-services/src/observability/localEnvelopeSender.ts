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
import * as FetchHttpClient from '@effect/platform/FetchHttpClient';
import * as HttpClient from '@effect/platform/HttpClient';
import * as HttpClientRequest from '@effect/platform/HttpClientRequest';
import { type ExportResult, ExportResultCode } from '@opentelemetry/core';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { exportResultFromHttpStatus } from './httpExportResult';

class EnvelopeSerializationError extends Schema.TaggedError<EnvelopeSerializationError>()(
  'EnvelopeSerializationError',
  { message: Schema.String, cause: Schema.Unknown }
) {}

/** Matches the private sender shape the Azure exporters call (trace: `sender`, log: `_sender`). */
export type LocalEnvelopeSender = {
  exportEnvelopes: (envelopes: unknown[]) => Promise<ExportResult>;
  shutdown: () => Promise<void>;
};

export const makeLocalEnvelopeSender = (localEndpoint: string): LocalEnvelopeSender => {
  const trackUrl = `${localEndpoint.replace(/\/$/, '')}/v2.1/track`;
  return {
    exportEnvelopes: (envelopes: unknown[]): Promise<ExportResult> =>
      FetchHttpClient.layer.pipe(
        Layer.toRuntime,
        Effect.flatMap(runtime =>
          Effect.try({
            try: () =>
              HttpClientRequest.post(trackUrl).pipe(
                HttpClientRequest.bodyText(
                  envelopes.map(e => JSON.stringify(e)).join('\n'),
                  'application/x-json-stream'
                )
              ),
            catch: cause =>
              new EnvelopeSerializationError({
                message: 'Failed to serialize local Breeze envelopes',
                cause
              })
          }).pipe(
            Effect.flatMap(HttpClient.execute),
            Effect.map(res =>
              exportResultFromHttpStatus(res.status, status => `local /v2.1/track responded ${status}`)
            ),
            Effect.catchAll(error => Effect.succeed({ code: ExportResultCode.FAILED, error })),
            Effect.withTracerEnabled(false),
            Effect.provide(runtime)
          )
        ),
        Effect.scoped,
        Effect.runPromise
      ),
    shutdown: () => Promise.resolve()
  };
};
