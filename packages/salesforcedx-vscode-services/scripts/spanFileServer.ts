/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-restricted-imports -- standalone Node script, not extension code */
/* eslint-disable functional/no-try-statements -- sync request handling */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- JSON.parse result */
import { appendFileSync, mkdirSync } from 'node:fs';
import * as http from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const PORT = 3003;
const SPANS_DIR = join(homedir(), '.sf', 'vscode-spans');
// App Insights envelopes (what the Azure Monitor exporter would POST to /v2.1/track) land here,
// kept separate from spans so the actual telemetry payload can be inspected on its own.
const APP_INSIGHTS_DIR = join(homedir(), '.sf', 'vscode-appinsights');

const filePaths = new Map<string, string>();
const otlpFilePathHolder: { value: string | undefined } = { value: undefined };
const trackFilePathHolders: Record<'node' | 'web', { value: string | undefined }> = {
  node: { value: undefined },
  web: { value: undefined }
};

const getFilePath = (extensionName: string): string => {
  const existing = filePaths.get(extensionName);
  if (existing) return existing;
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const path = join(SPANS_DIR, `web-${extensionName}-${timestamp}.jsonl`);
  filePaths.set(extensionName, path);
  return path;
};

const getOtlpFilePath = (): string => {
  if (!otlpFilePathHolder.value) {
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    otlpFilePathHolder.value = join(SPANS_DIR, `otlp-${timestamp}.jsonl`);
  }
  return otlpFilePathHolder.value;
};

// Node Breeze envelopes → appinsights-*.jsonl; web extension-telemetry events → appinsights-web-*.jsonl.
const getTrackFilePath = (platform: 'node' | 'web'): string => {
  const holder = trackFilePathHolders[platform];
  if (!holder.value) {
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
    const prefix = platform === 'web' ? 'appinsights-web' : 'appinsights';
    holder.value = join(APP_INSIGHTS_DIR, `${prefix}-${timestamp}.jsonl`);
  }
  return holder.value;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const send = (res: http.ServerResponse, status: number, body: string): void => {
  res.writeHead(status, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(body);
};

const handleRequest = (req: http.IncomingMessage, res: http.ServerResponse): void => {
  if (req.method === 'OPTIONS') {
    send(res, 200, '');
    return;
  }

  const validUrls = ['/spans', '/otlp-spans', '/v2.1/track'];
  if (req.method !== 'POST' || !validUrls.includes(req.url ?? '')) {
    send(res, 404, JSON.stringify({ error: `POST ${validUrls.join(', ')} only` }));
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    try {
      // /v2.1/track receives App Insights telemetry from BOTH platforms; the handler sorts by
      // shape (gzipped Breeze envelopes from Node vs plain extension-telemetry events from web).
      if (req.url === '/v2.1/track') {
        handleTrack(Buffer.concat(chunks), req.headers['content-encoding'], res);
        return;
      }

      const body = Buffer.concat(chunks).toString();

      if (req.url === '/otlp-spans') {
        handleOtlpSpans(body, res);
        return;
      }

      const parsed = JSON.parse(body) as { extensionName?: string; spans?: string[] };
      const { extensionName, spans } = parsed;

      if (typeof extensionName !== 'string' || !Array.isArray(spans)) {
        send(res, 400, JSON.stringify({ error: 'Expected { extensionName: string, spans: string[] }' }));
        return;
      }

      mkdirSync(SPANS_DIR, { recursive: true });
      const filePath = getFilePath(extensionName);
      const lines = spans.filter((s): s is string => typeof s === 'string').join('\n') + (spans.length > 0 ? '\n' : '');
      if (lines) appendFileSync(filePath, lines);

      send(res, 200, JSON.stringify({ success: true }));
    } catch (error) {
      send(res, 400, JSON.stringify({ error: String(error) }));
    }
  });
};

const handleOtlpSpans = (body: string, res: http.ServerResponse): void => {
  const parsed = JSON.parse(body) as { lines?: string[] };
  const { lines } = parsed;

  if (!Array.isArray(lines)) {
    send(res, 400, JSON.stringify({ error: 'Expected { lines: string[] }' }));
    return;
  }

  mkdirSync(SPANS_DIR, { recursive: true });
  const content = lines.filter((l): l is string => typeof l === 'string').join('\n') + (lines.length > 0 ? '\n' : '');
  if (content) appendFileSync(getOtlpFilePath(), content);
  send(res, 200, JSON.stringify({ success: true }));
};

/**
 * Receives the App Insights telemetry both platforms would POST to Azure and writes it to
 * ~/.sf/vscode-appinsights/. Sorts the two shapes the local divert can produce:
 * Node sends gzipped newline-delimited Breeze envelopes (each has a `data.baseType`) → appinsights-*;
 * web sends plain JSON extension-telemetry events (`name`/`eventType`/properties) → appinsights-web-*.
 * Responds with the Breeze TrackResponse shape; the Azure exporter treats anything else as a
 * failure and retries/persists, so this response satisfies both callers.
 */
const handleTrack = (raw: Buffer, contentEncoding: string | undefined, res: http.ServerResponse): void => {
  const body = contentEncoding === 'gzip' ? gunzipSync(raw).toString() : raw.toString();
  const lines = body
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Web events have no Breeze `data.baseType`; Node Breeze envelopes do.
  const isWeb = lines.length > 0 && !lines.some(l => l.includes('"baseType"'));
  const platform = isWeb ? 'web' : 'node';

  mkdirSync(APP_INSIGHTS_DIR, { recursive: true });
  if (lines.length > 0) appendFileSync(getTrackFilePath(platform), `${lines.join('\n')}\n`);

  send(res, 200, JSON.stringify({ itemsReceived: lines.length, itemsAccepted: lines.length, errors: [] }));
};

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`Span file server listening on http://localhost:${PORT}`);
  console.log(`Spans → ${SPANS_DIR}`);
  console.log(`App Insights telemetry (POST /v2.1/track, Node + web) → ${APP_INSIGHTS_DIR}\n`);
});

server.on('error', err => {
  console.error('Server error:', err);
  process.exit(1);
});

const shutdown = (): void => {
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
