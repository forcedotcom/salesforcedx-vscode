/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as http from 'node:http';

const PORT = 3002;

const SEPARATOR = '='.repeat(80);

type JsonEndState = { depth: number; done: boolean; end?: number };

const findJsonEnd = (str: string, start: number): number | undefined => {
  const chars = str.split('').slice(start, Math.min(str.length, start + 10_000));
  const initialState: JsonEndState = { depth: 0, done: false };
  const result = chars.reduce((acc, char, idx) => {
    if (acc.done) return acc;
    const actualIdx = start + idx;
    const prevChar = actualIdx > 0 ? str[actualIdx - 1] : '';

    if (char === '{' && prevChar !== '\\') {
      return { depth: acc.depth + 1, done: false };
    }
    if (char === '}' && prevChar !== '\\') {
      const newDepth = acc.depth - 1;
      return newDepth === 0 ? { depth: newDepth, done: true, end: actualIdx + 1 } : { depth: newDepth, done: false };
    }
    return acc;
  }, initialState);
  return result.end;
};

const extractJsonObjects = (str: string): string[] => {
  const jsonStartPattern = /\{"name"/g;
  const allMatchIndices: number[] = [];
  const pattern = new RegExp(jsonStartPattern.source, jsonStartPattern.flags);

  const findMatches = (startIdx: number): number[] => {
    pattern.lastIndex = startIdx;
    const match = pattern.exec(str);
    if (match === null || match.index >= str.length) return allMatchIndices;
    allMatchIndices.push(match.index);
    return findMatches(match.index + 1);
  };

  const matches = findMatches(0);

  return matches
    .map(start => ({ start, end: findJsonEnd(str, start) }))
    .filter((match): match is { start: number; end: number } => match.end !== undefined)
    .map(({ start, end }) => str.substring(start, end))
    .map(jsonStr =>
      Effect.try({
        try: () => {
          const parsed = JSON.parse(jsonStr);
          return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : undefined;
        },
        catch: () => undefined
      })
    )
    .map(effect => Effect.runSync(effect))
    .filter((json): json is Record<string, unknown> => json !== undefined)
    .map(json => JSON.stringify(json, undefined, 2));
};

const parseBody = (body: string) =>
  Effect.try({
    try: () => JSON.parse(body),
    catch: error => (error instanceof Error ? error : new Error(String(error)))
  }).pipe(
    Effect.flatMap(parsed => {
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return Effect.fail(new Error('Invalid JSON: expected object'));
      }
      const { base64Env, ...rest } = parsed;
      return Effect.succeed({ base64Env: typeof base64Env === 'string' ? base64Env : undefined, rest });
    })
  );

const decodeBase64Env = (base64Env: string) =>
  Effect.try({
    try: () => {
      const decoded = Buffer.from(base64Env, 'base64');
      const asString = decoded.toString('utf-8');
      return extractJsonObjects(asString);
    },
    catch: error => (error instanceof Error ? error : new Error(String(error)))
  });

const logRequest = (method: string | undefined, url: string | undefined, headers: http.IncomingHttpHeaders): void => {
  const timestamp = new Date().toISOString();
  console.log(`\n${SEPARATOR}`);
  console.log(`[${timestamp}] ${method ?? 'UNKNOWN'} ${url ?? '/'}`);
  console.log('-'.repeat(80));
  console.log('Headers:');
  Object.entries(headers).forEach(([key, value]) => {
    console.log(`  ${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
  });
};

const logBody = (rest: Record<string, unknown>): void => {
  if (Object.keys(rest).length > 0) {
    console.log('\nBody:');
    console.log(JSON.stringify(rest, undefined, 2));
  }
};

const logDecodedJson = (jsonMatches: string[]): void => {
  if (jsonMatches.length > 0) {
    jsonMatches.forEach((json, idx) => {
      if (jsonMatches.length > 1) {
        console.log(`\n--- Event ${idx + 1} ---`);
      }
      console.log(json);
    });
  } else {
    console.log('(No readable JSON found in decoded data)');
  }
};

const handleRequest = (req: http.IncomingMessage, res: http.ServerResponse): void => {
  const chunks: Buffer[] = [];

  req.on('data', chunk => {
    chunks.push(chunk);
  });

  req.on('end', () => {
    const body = Buffer.concat(chunks).toString();
    logRequest(req.method, req.url, req.headers);

    if (body) {
      Effect.runSync(
        parseBody(body).pipe(
          Effect.tap(({ rest }) => Effect.sync(() => logBody(rest))),
          Effect.flatMap(({ base64Env }) =>
            base64Env
              ? decodeBase64Env(base64Env).pipe(
                  Effect.tap(() => Effect.sync(() => console.log('\nDecoded base64Env (human-readable JSON only):'))),
                  Effect.tap(jsonMatches => Effect.sync(() => logDecodedJson(jsonMatches))),
                  Effect.catchAll(() => Effect.sync(() => console.log('Failed to decode base64Env')))
                )
              : Effect.succeed([])
          ),
          Effect.catchAll(() => Effect.sync(() => console.log(body)))
        )
      );
    }

    console.log(`${SEPARATOR}\n`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  });
};

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`O11y Debug Server listening on http://localhost:${PORT}`);
  console.log('Waiting for requests...\n');
});

server.on('error', err => {
  console.error('Server error:', err);
  process.exit(1);
});
