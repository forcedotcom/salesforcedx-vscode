/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  openFileByName,
  readAllSpanRows,
  reloadWindow,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForSpanRows,
  type SpanRow
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';
import { triggerLspRestart, waitForApexLspReady } from '../utils/apexLspUtils';

// Spans are written as JSONL to ~/.sf/vscode-spans (enableFileTraces is on by default in desktop e2e).
// The dir is shared across runs, extensions, and window lifetimes. A reload can rotate the exporter to a
// new jsonl, so read their union and use the span start time to retain only this test's Electron session.
const nowNanos = (): bigint => BigInt(Date.now()) * 1_000_000n;

const spanRowsSince = (baselineNanos: bigint) => async (): Promise<SpanRow[]> =>
  (await readAllSpanRows()).filter(row => row.kind === 'span' && BigInt(row.startTimeUnixNano ?? '0') > baselineNanos);

const byName = (rows: SpanRow[], name: string): SpanRow[] => rows.filter(r => r.name === name);

// Two separate test() blocks (not one-test-with-steps) is intentional here: each scenario needs a
// FRESH Electron session and its own timestamp baseline so the apex.lsp.client count assertion
// (exactly-1 vs exactly-2-after-restart) is unambiguous. See apexLspRestart.desktop.spec.ts for the same
// multi-test-per-file precedent in this directory.
test('apex LSP activation telemetry is emitted as Effect spans; client is one span not N', async ({
  page,
  workspaceDir
}) => {
  test.setTimeout(360_000);
  const sessionStarted = nowNanos();
  const readSessionSpans = spanRowsSince(sessionStarted);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('open .cls and wait for LSP ready', async () => {
    await openFileByName(page, 'ExampleClass.cls');
    await waitForApexLspReady(page, workspaceDir);
  });

  await test.step('apex.lsp.settings span emitted on activation with maxHeapSize', async () => {
    await waitForSpanRows(
      readSessionSpans,
      rows => byName(rows, 'apex.lsp.settings').some(s => s.attributes?.maxHeapSize !== undefined),
      'apex.lsp.settings span with maxHeapSize'
    );
  });

  await test.step('apex.lsp.startup span emitted on activation with activationTime', async () => {
    await waitForSpanRows(
      readSessionSpans,
      rows => byName(rows, 'apex.lsp.startup').some(s => s.attributes?.activationTime !== undefined),
      'apex.lsp.startup span with activationTime'
    );
  });

  await test.step('reload flushes exactly one apex.lsp.client span', async () => {
    // Reload the window: VS Code deactivates the extension → deactivate() closes the extension scope →
    // the long-lived apex.lsp.client span ends and the file exporter flushes it. The exporter can create
    // a new jsonl for the reloaded window, so the assertion reads every file from this test's session.
    await reloadWindow(page);

    // ADR central decision: this one client session produced exactly ONE apex.lsp.client span
    // (attrs merged onto the held span, last-write-wins), NOT one span per Jorje apexLSPLog event.
    const flushed = await waitForSpanRows(
      readSessionSpans,
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
  const sessionStarted = nowNanos();
  const readSessionSpans = spanRowsSince(sessionStarted);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('first client lifetime: open .cls and wait for LSP ready', async () => {
    await openFileByName(page, 'ExampleClass.cls');
    await waitForApexLspReady(page, workspaceDir);
  });

  await test.step('restart emits apex.lsp.restart span with restart attrs', async () => {
    // Drive a second `createLanguageServer` (second client lifetime). This closes the prior client's
    // child scope, which ends/flushes the first apex.lsp.client span into the session jsonl.
    await triggerLspRestart(page, workspaceDir, { cleanDb: false, via: 'palette' });

    const rows = await waitForSpanRows(
      readSessionSpans,
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
    // this session's files. If restart extended a single shared scope (the N-not-1 regression), the
    // first lifetime's span would never end at restart and this count would be wrong.
    const flushed = await waitForSpanRows(
      readSessionSpans,
      r => byName(r, 'apex.lsp.client').length >= 2,
      'both client-lifetime spans flushed'
    );
    expect(byName(flushed, 'apex.lsp.client').length).toBe(2);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
