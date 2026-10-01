/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Contents of every `*.jsonl` file in `dir`; empty and unreadable files are dropped, a missing `dir`
 * yields `[]`. Several extensions can write their own timestamped file into the same directory, so
 * specs must read the union rather than guess a newest one. `since` (epoch ms) keeps only files
 * modified at/after it, so assertions can't be satisfied by an earlier run's leftovers.
 */
export const readJsonlFiles = async (dir: string, since = 0): Promise<string[]> => {
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const contents = await Promise.all(
    entries
      .filter(name => name.endsWith('.jsonl'))
      .map(async name => {
        const file = path.join(dir, name);
        const stat = await fs.stat(file).catch(() => undefined);
        return stat && stat.mtimeMs >= since ? fs.readFile(file, 'utf-8').catch(() => '') : '';
      })
  );
  return contents.filter(Boolean);
};

/** JSONL bodies (as returned by `readJsonlFiles`) parsed row by row, blank lines skipped */
export const parseJsonlLines = <T>(contents: string[]): T[] =>
  contents.flatMap(text =>
    text
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as T)
  );
