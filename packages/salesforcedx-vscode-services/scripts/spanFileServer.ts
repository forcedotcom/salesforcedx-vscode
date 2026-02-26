/*
 * Copyright (c) 2025, salesforce.com, inc.
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

const PORT = 3003;
const SPANS_DIR = join(homedir(), '.sf', 'vscode-spans');

const filePaths = new Map<string, string>();

const getFilePath = (extensionName: string): string => {
  const existing = filePaths.get(extensionName);
  if (existing) return existing;
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const path = join(SPANS_DIR, `web-${extensionName}-${timestamp}.jsonl`);
  filePaths.set(extensionName, path);
  return path;
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

  if (req.method !== 'POST' || req.url !== '/spans') {
    send(res, 404, JSON.stringify({ error: 'POST /spans only' }));
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const body = Buffer.concat(chunks).toString();
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

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`Span file server listening on http://localhost:${PORT}`);
  console.log(`Writing to ${SPANS_DIR}\n`);
});

server.on('error', err => {
  console.error('Server error:', err);
  process.exit(1);
});
