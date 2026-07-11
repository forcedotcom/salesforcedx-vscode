/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  openFileByName,
  reloadWindow,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
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
// The dir is shared across runs. newestSpanFile() picks the lexically-newest jsonl in the dir; each
// test captures that once (after waitForApexLspReady, which comfortably exceeds the BatchSpanProcessor
// flush delay so the current session's file exists) and then targets that single file for all asserts.
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

// Narrow the newestSpanFile() result to a string so the rest of the test body avoids `!` assertions.
const requireFile = (file: string | undefined): string => {
  if (file === undefined) throw new Error('a span jsonl file should exist after activation');
  return file;
};

// Two separate test() blocks (not one-test-with-steps) is intentional here: each scenario needs a
// FRESH Electron session so its span jsonl file starts empty and the apex.lsp.client count assertion
// (exactly-1 vs exactly-2-after-restart) is unambiguous. Sharing one session would carry the first
// scenario's flushed client span into the second's count. See apexLspRestart.desktop.spec.ts for the
// same multi-test-per-file precedent in this directory.
test('apex LSP activation telemetry is emitted as Effect spans; client is one span not N', async ({
  page,
  workspaceDir
}) => {
  test.setTimeout(360_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const sessionFile = await test.step('open .cls and wait for LSP ready', async () => {
    await openFileByName(page, 'ExampleClass.cls');
    await waitForApexLspReady(page, workspaceDir);
    const file = await newestSpanFile();
    expect(file, 'a span jsonl file should exist after activation').toBeDefined();
    return requireFile(file);
  });

  await test.step('apex.lsp.settings span emitted on activation with maxHeapSize', async () => {
    await waitForSpans(
      sessionFile,
      rows => byName(rows, 'apex.lsp.settings').some(s => s.attributes?.maxHeapSize !== undefined),
      'apex.lsp.settings span with maxHeapSize'
    );
  });

  await test.step('apex.lsp.startup span emitted on activation with activationTime', async () => {
    await waitForSpans(
      sessionFile,
      rows => byName(rows, 'apex.lsp.startup').some(s => s.attributes?.activationTime !== undefined),
      'apex.lsp.startup span with activationTime'
    );
  });

  await test.step('reload flushes exactly one apex.lsp.client span', async () => {
    // Reload the window: VS Code deactivates the extension → deactivate() closes the extension scope →
    // the long-lived apex.lsp.client span ends and the file exporter flushes it into this session's jsonl.
    await reloadWindow(page);

    // ADR central decision: this one client session produced exactly ONE apex.lsp.client span
    // (attrs merged onto the held span, last-write-wins), NOT one span per Jorje apexLSPLog event.
    const flushed = await waitForSpans(
      sessionFile,
      rows => byName(rows, 'apex.lsp.client').length > 0,
      'flushed apex.lsp.client span'
    );
    expect(byName(flushed, 'apex.lsp.client').length).toBe(1);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('apex LSP restart emits a restart span AND still flushes exactly one client span per lifetime', async ({
  page,
  workspaceDir
}) => {
  test.setTimeout(360_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const sessionFile = await test.step('first client lifetime: open .cls and wait for LSP ready', async () => {
    await openFileByName(page, 'ExampleClass.cls');
    await waitForApexLspReady(page, workspaceDir);
    const file = await newestSpanFile();
    expect(file, 'a span jsonl file should exist after activation').toBeDefined();
    return requireFile(file);
  });

  await test.step('restart emits apex.lsp.restart span with restart attrs', async () => {
    // Drive a second `createLanguageServer` (second client lifetime). This closes the prior client's
    // child scope, which ends/flushes the first apex.lsp.client span into the session jsonl.
    await triggerLspRestart(page, workspaceDir, { cleanDb: false, via: 'palette' });

    const rows = await waitForSpans(
      sessionFile,
      r => byName(r, 'apex.lsp.restart').some(s => s.attributes?.selectedOption !== undefined),
      'apex.lsp.restart span with restart attrs'
    );
    const restartSpan = byName(rows, 'apex.lsp.restart').find(s => s.attributes?.selectedOption !== undefined);
    expect(restartSpan?.attributes?.source).toBeDefined();
  });

  await test.step('second lifetime + reload flushes exactly two client spans', async () => {
    // Generate more Jorje events against the restarted client, then reload → deactivate closes the
    // parent scope, ending/flushing the second client lifetime's span.
    await openFileByName(page, 'ExampleClass.cls');
    await waitForApexLspReady(page, workspaceDir);
    await reloadWindow(page);

    // ADR central decision under restart: exactly ONE apex.lsp.client span per lifetime — NOT
    // N-per-event and NOT accumulated-across-restarts. One restart ⇒ two lifetimes ⇒ two spans in
    // this session's jsonl. If restart extended a single shared scope (the N-not-1 regression), the
    // first lifetime's span would never end at restart and this count would be wrong.
    const flushed = await waitForSpans(
      sessionFile,
      r => byName(r, 'apex.lsp.client').length >= 2,
      'both client-lifetime spans flushed'
    );
    expect(byName(flushed, 'apex.lsp.client').length).toBe(2);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
