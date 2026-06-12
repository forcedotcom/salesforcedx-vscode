/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-restricted-imports -- standalone Node script, not extension code */
/* eslint-disable functional/no-try-statements -- sync request handling */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- JSON.parse result */
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import * as http from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PORT = 3003;
const SPANS_DIR = join(homedir(), '.sf', 'vscode-spans');

const filePaths = new Map<string, string>();
const otlpFilePathHolder: { value: string | undefined } = { value: undefined };

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

  if (req.method !== 'POST' || (req.url !== '/spans' && req.url !== '/otlp-spans')) {
    send(res, 404, JSON.stringify({ error: 'POST /spans or /otlp-spans only' }));
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    try {
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

const server = http.createServer(handleRequest);

const onListening = (): void => {
  console.log(`Span file server listening on http://localhost:${PORT}`);
  console.log(`Writing to ${SPANS_DIR}\n`);
};

server.listen(PORT, onListening);

// In CI, a step's timeout can SIGKILL wireit before it tears down this service. wireit spawns it
// detached in its own process group, so an orphaned server keeps holding PORT 3003 and the next
// step's server then fails with EADDRINUSE. Watching ppid doesn't help: the intermediate `sh -c`
// that wireit launches survives the orphaning, so our parent never changes. Instead, on EADDRINUSE
// reclaim the port by killing whatever holds it, then retry once. Gated to non-Windows: `lsof` isn't
// available there, and Windows kills the whole process tree so the orphan never happens anyway.
const IS_WINDOWS = process.platform === 'win32';
const reclaimState = { attempted: false };

const reclaimPortAndRetry = (): void => {
  reclaimState.attempted = true;
  const result = spawnSync('lsof', ['-ti', `tcp:${PORT}`], { encoding: 'utf8' });
  const pids = (result.stdout ?? '')
    .split('\n')
    .map(s => Number.parseInt(s.trim(), 10))
    .filter(pid => Number.isInteger(pid) && pid !== process.pid);
  pids.forEach(pid => {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  });
  console.error(`Span file server: reclaimed port ${PORT} from pid(s) ${pids.join(', ') || 'none'}; retrying`);
  setTimeout(() => server.listen(PORT, onListening), 500);
};

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE' && !IS_WINDOWS && !reclaimState.attempted) {
    reclaimPortAndRetry();
    return;
  }
  console.error('Server error:', err);
  process.exit(1);
});

const shutdown = (): void => {
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
