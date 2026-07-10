/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { openFileByName, reloadWindow } from '@salesforce/playwright-vscode-ext';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { test } from '../fixtures';
import { triggerLspRestart, waitForApexLspReady } from '../utils/apexLspUtils';

// Spans are written as JSONL to ~/.sf/vscode-spans (enableFileTraces is on by default in desktop e2e).
// The dir is shared across runs, so each assertion targets a specific jsonl file (one per Electron
// session) captured during the test — never a blind "newest across the dir".
const SPANS_DIR = path.join(os.homedir(), '.sf', 'vscode-spans');

type SpanRow = { kind?: string; name?: string; attributes?: Record<string, unknown> };

const newestSpanFile = async (): Promise<string | undefined> => {
  const entries = await fs.readdir(SPANS_DIR).catch(() => [] as string[]);
  const jsonl = entries
    .filter(name => name.endsWith('.jsonl'))
    .toSorted()
    .toReversed();
  return jsonl[0];
};

const readSpanRows = async (file: string): Promise<SpanRow[]> => {
  const contents = await fs.readFile(path.join(SPANS_DIR, file), 'utf-8').catch(() => '');
  return contents
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as SpanRow)
    .filter(row => row.kind === 'span');
};

class SpansNotReadyError extends Data.TaggedError('SpansNotReadyError')<{ readonly message: string }> {}

// Poll a specific span file until `predicate` holds over its span rows.
const waitForSpans = (file: string, predicate: (rows: SpanRow[]) => boolean, message: string): Promise<SpanRow[]> =>
  Effect.runPromise(
    Effect.tryPromise({
      try: async () => {
        const rows = await readSpanRows(file);
        if (!predicate(rows)) throw new SpansNotReadyError({ message });
        return rows;
      },
      catch: () => new SpansNotReadyError({ message })
    }).pipe(Effect.retry(Schedule.spaced(Duration.seconds(1))), Effect.timeout(Duration.seconds(90)))
  );

const byName = (rows: SpanRow[], name: string): SpanRow[] => rows.filter(r => r.name === name);

test('apex LSP activation telemetry is emitted as Effect spans; client is one span not N', async ({
  page,
  workspaceDir
}) => {
  test.setTimeout(360_000);

  await openFileByName(page, 'ExampleClass.cls');
  await waitForApexLspReady(page, workspaceDir);

  const sessionFile = await newestSpanFile();
  expect(sessionFile, 'a span jsonl file should exist after activation').toBeDefined();

  // 1. apex.lsp.settings span emitted on activation with maxHeapSize attribute.
  await waitForSpans(
    sessionFile!,
    rows => byName(rows, 'apex.lsp.settings').some(s => s.attributes?.maxHeapSize !== undefined),
    'apex.lsp.settings span with maxHeapSize'
  );

  // 2. apex.lsp.startup span emitted on activation with activationTime attribute.
  await waitForSpans(
    sessionFile!,
    rows => byName(rows, 'apex.lsp.startup').some(s => s.attributes?.activationTime !== undefined),
    'apex.lsp.startup span with activationTime'
  );

  // Reload the window: VS Code deactivates the extension → deactivate() closes the extension scope →
  // the long-lived apex.lsp.client span ends and the file exporter flushes it into this session's jsonl.
  await reloadWindow(page);

  // 3. ADR central decision: this one client session produced exactly ONE apex.lsp.client span
  //    (attrs merged onto the held span, last-write-wins), NOT one span per Jorje apexLSPLog event.
  const flushed = await waitForSpans(
    sessionFile!,
    rows => byName(rows, 'apex.lsp.client').length > 0,
    'flushed apex.lsp.client span'
  );
  expect(byName(flushed, 'apex.lsp.client').length).toBe(1);
});

test('apex LSP restart emits an apex.lsp.restart span with restart attributes', async ({ page, workspaceDir }) => {
  test.setTimeout(360_000);

  await openFileByName(page, 'ExampleClass.cls');
  await waitForApexLspReady(page, workspaceDir);

  const sessionFile = await newestSpanFile();
  expect(sessionFile, 'a span jsonl file should exist after activation').toBeDefined();

  await triggerLspRestart(page, workspaceDir, { cleanDb: false, via: 'palette' });

  const rows = await waitForSpans(
    sessionFile!,
    r => byName(r, 'apex.lsp.restart').some(s => s.attributes?.selectedOption !== undefined),
    'apex.lsp.restart span with restart attrs'
  );
  const restartSpan = byName(rows, 'apex.lsp.restart').find(s => s.attributes?.selectedOption !== undefined);
  expect(restartSpan?.attributes?.source).toBeDefined();
});
