/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * DIAGNOSTIC spec: run a core-backed command from a package that depends on the CORE extension
 * (lightning), then dump what each telemetry pipeline emits.
 *
 * Two pipelines, two on-disk sinks (both class-based reporters — AppInsights, O11yReporter — are
 * INERT in dev/test mode; determineReporters.ts returns only TelemetryFile, and only when
 * localTelemetryLogging is on. So the observable AppInsights *shape* comes from TelemetryFile):
 *
 *   1. O11y / services (Effect spans)  → ~/.sf/vscode-spans/*.jsonl  (enableFileTraces, on by default)
 *   2. AppInsights shape (TelemetryFile) → {workspace}/salesforcedx-vscode-core-telemetry.json
 *
 * The telemetry fixture flips telemetry.telemetryLevel back to 'all' + localTelemetryLogging 'true'
 * and launches against a minimal org so org-identity props (orgId, isScratch, orgEdition, …) populate.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  reloadWindow,
  verifyCommandExists,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady,
  EDITOR_WITH_URI,
  QUICK_INPUT_WIDGET
} from '@salesforce/playwright-vscode-ext';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { telemetryDesktopTest as test } from '../fixtures/telemetryFixtures';

const SPANS_DIR = path.join(os.homedir(), '.sf', 'vscode-spans');
const CORE_TELEMETRY_FILE = 'salesforcedx-vscode-core-telemetry.json';

type SpanRow = { kind?: string; name?: string; attributes?: Record<string, unknown>; durationMs?: number };

// The core ext and lightning ext each bundle their own services SDK, so each writes to its OWN
// timestamped {SPANS_DIR}/*.jsonl. And BatchSpanProcessor buffers — a root command span isn't on
// disk until an interval flush or (reliably) window reload/deactivate. So: reload first, then read
// the UNION of all span files rather than guessing a single newest one.
const readAllSpanRows = async (): Promise<SpanRow[]> => {
  const entries = await fs.readdir(SPANS_DIR).catch(() => [] as string[]);
  const files = entries.filter(name => name.endsWith('.jsonl'));
  const perFile = await Promise.all(
    files.map(async file => {
      const contents = await fs.readFile(path.join(SPANS_DIR, file), 'utf-8').catch(() => '');
      return contents
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as SpanRow)
        .filter(row => row.kind === 'span');
    })
  );
  return perFile.flat();
};

class NotReadyError extends Data.TaggedError('NotReadyError')<{ readonly message: string }> {}

const waitFor = <A>(read: () => Promise<A>, predicate: (a: A) => boolean, message: string): Promise<A> =>
  Effect.runPromise(
    Effect.tryPromise({
      try: async () => {
        const value = await read();
        if (!predicate(value)) throw new NotReadyError({ message });
        return value;
      },
      catch: () => new NotReadyError({ message })
    }).pipe(Effect.retry(Schedule.spaced(Duration.seconds(1))), Effect.timeout(Duration.seconds(90)))
  );

// TelemetryFile writes a trailing-comma-separated list of pretty JSON objects (not valid JSON as a
// whole). Wrap in [] and strip the trailing comma to parse the events it captured.
const readTelemetryFileEvents = async (
  workspaceDir: string
): Promise<Array<{ command: string; data: Record<string, unknown> }>> => {
  const raw = await fs.readFile(path.join(workspaceDir, CORE_TELEMETRY_FILE), 'utf-8').catch(() => '');
  if (!raw.trim()) return [];
  return JSON.parse(`[${raw.trim().replace(/,\s*$/, '')}]`) as Array<{
    command: string;
    data: Record<string, unknown>;
  }>;
};

test('telemetry output: o11y spans + AppInsights-shape events from a core-dependent command', async ({
  page,
  workspaceDir
}) => {
  test.setTimeout(360_000);

  await test.step('workbench ready', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  await test.step('run a core-backed command (Create Aura Component)', async () => {
    const command = packageNls.lightning_generate_aura_component_text;
    await verifyCommandExists(page, command, 60_000);
    await executeCommandWithCommandPalette(page, command);

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type('TelemetryProbeCmp');
    await page.keyboard.press('Enter');
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');

    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 30_000 });
  });

  await test.step('reload to flush buffered spans + class-telemetry (deactivationEvent)', async () => {
    // Reload ends the extension scopes: services flushes its BatchSpanProcessor buffer to
    // ~/.sf/vscode-spans/*.jsonl, and core's deactivate() calls sendExtensionDeactivationEvent() +
    // dispose(), flushing TelemetryFile's buffer to {workspace}/salesforcedx-vscode-core-telemetry.json.
    await reloadWindow(page);
    await waitForVSCodeWorkbench(page);
  });

  await test.step('dump o11y spans + org-identity attributes', async () => {
    const rows = await waitFor(
      () => readAllSpanRows(),
      r => r.length > 0,
      'no o11y spans flushed yet'
    );

    const spanNames = [...new Set(rows.map(s => s.name))].toSorted();
    console.log('=== O11Y SPAN NAMES THIS SESSION ===');
    console.log(JSON.stringify(spanNames, null, 2));

    // The org-identity attributes are stamped on every root span by spanTransformProcessor. Pull them
    // off whichever span carries them (the command span if present, else any enriched root span).
    const orgAttrKeys = [
      'orgId',
      'devHubOrgId',
      'isScratch',
      'isSandbox',
      'tracksSource',
      'orgEdition',
      'telemetryTag',
      'cliId',
      'webUserId'
    ];
    const enriched = rows.find(s => orgAttrKeys.some(k => s.attributes?.[k] !== undefined));
    const orgAttrs: Record<string, unknown> = Object.fromEntries(
      orgAttrKeys.map(k => [k, enriched?.attributes?.[k]] as const).filter(([, v]) => v !== undefined)
    );
    console.log('=== O11Y ORG-IDENTITY ATTRIBUTES (from span:', enriched?.name, ') ===');
    console.log(JSON.stringify(orgAttrs, null, 2));

    // The FULL attribute set on this enriched span is exactly what BOTH downstream exporters send:
    // the O11y exporter AND the AppInsights customEvents exporter (ApplicationInsightsNodeExporter)
    // consume the same enriched span (see spansNode.ts). The common.* keys exist specifically for
    // the AppInsights side. Only the transport differs — in dev/test AppInsights diverts to
    // localhost:3003, so nothing lands on disk; this dump is the payload it would send.
    console.log('=== FULL ENRICHED SPAN ATTRIBUTES (what O11y AND AppInsights receive) ===');
    console.log(JSON.stringify(enriched?.attributes, null, 2));

    const commandSpan = rows.find(s => s.name === 'sf.lightning.generate.aura.component');
    console.log('=== O11Y COMMAND SPAN (sf.lightning.generate.aura.component) ===');
    console.log(commandSpan ? JSON.stringify(commandSpan, null, 2) : 'not flushed to file this run');

    expect(enriched?.attributes?.telemetryTag, 'e2e spans should carry the telemetry-tag').toBe('e2e-test');
    expect(orgAttrs.orgId, 'org-identity should populate from the minimal org').toBeDefined();
  });

  await test.step('dump legacy class-reporter events (TelemetryFile), if any', async () => {
    // The legacy class-based reporters (AppInsights/O11yReporter/TelemetryFile in utils-vscode) are
    // INERT in dev/test: determineReporters returns only TelemetryFile, gated on localTelemetryLogging,
    // and even that setting is undeclared in package.json. So this file is usually absent. Best-effort
    // dump — do NOT fail the run on its absence; the span pipeline above is the source of truth.
    const events = await readTelemetryFileEvents(workspaceDir);
    console.log('=== LEGACY TelemetryFile EVENTS (salesforcedx-vscode-core-telemetry.json) ===');
    console.log(
      events.length > 0 ? JSON.stringify(events, null, 2) : 'none — legacy class reporters inert in test mode'
    );
  });

  // No validateNoCriticalErrors: this is a diagnostic dump, not a product-behavior assertion, and
  // enabling telemetry can surface unrelated network noise from the reporters.
});
