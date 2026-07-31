/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { readJsonlFiles, parseJsonlLines } from './jsonl';

/** Where the services SDK's file span exporter writes when `enableFileTraces` is on. */
export const SPANS_DIR = path.join(os.homedir(), '.sf', 'vscode-spans');

export type SpanRow = {
  kind?: string;
  name?: string;
  startTimeUnixNano?: string;
  attributes?: Record<string, unknown>;
};

/** Every span/log row in the dir. Each extension bundles its own services SDK and writes its OWN timestamped
 * jsonl, so read the union of all of them rather than guessing a single newest file. Missing dir/file → []. */
export const readAllSpanRows = async (dir: string = SPANS_DIR): Promise<SpanRow[]> =>
  parseJsonlLines<SpanRow>(await readJsonlFiles(dir));

/** Poll `read` until `predicate` holds, then return the rows. BatchSpanProcessor buffers, so rows appear a
 * flush interval after the command finishes; rejects with `message` once the timeout elapses. */
export const waitForSpanRows = async (
  read: () => Promise<SpanRow[]>,
  predicate: (rows: SpanRow[]) => boolean,
  message: string,
  { retryMs = 1000, timeoutMs = 90_000 }: { retryMs?: number; timeoutMs?: number } = {}
): Promise<SpanRow[]> => {
  const deadline = Date.now() + timeoutMs;
  const attempt = async (): Promise<SpanRow[]> => {
    const rows = await read().catch(() => [] as SpanRow[]);
    if (predicate(rows)) return rows;
    if (Date.now() >= deadline) throw new Error(`Timed out after ${timeoutMs}ms waiting for ${message}`);
    await new Promise(resolve => setTimeout(resolve, retryMs));
    return attempt();
  };
  return attempt();
};
