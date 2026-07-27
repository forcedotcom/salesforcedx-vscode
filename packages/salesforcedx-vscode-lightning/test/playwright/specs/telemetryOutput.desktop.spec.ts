/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * DIAGNOSTIC spec: run a core-backed command from a package that depends on the CORE extension
 * (lightning), then dump what the telemetry pipeline emits and — when local capture servers are
 * running — verify the actual on-the-wire payloads.
 *
 * The real telemetry is the services observability pipeline (Effect spans). ONE enriched span feeds
 * multiple exporters (spansNode.ts): the file exporter, the O11y exporter, and the AppInsights
 * exporter. What this spec observes:
 *
 *   1. Span file (always on)       → ~/.sf/vscode-spans/*.jsonl  (enableFileTraces; synchronous, always captured)
 *   2. AppInsights Breeze envelopes → POST http://localhost:3003/v2.1/track  → ~/.sf/vscode-appinsights/appinsights-*.jsonl
 *
 * (2) requires the capture server to be running, else the async POST is dropped:
 *   npm run spans:server -w salesforcedx-vscode-services   # AppInsights on :3003
 * In dev/test the AppInsights transport auto-diverts to :3003 (appInsights.ts isLocalDivertMode force-enables
 * telemetry — provably cannot reach Azure). Verified envelopes carry the command span
 * (sf.lightning.generate.aura.component) with full org identity incl. orgEdition.
 *
 * O11y default transport POSTs THROUGH the org connection (getConnectionMethod().requestPost →
 * /services/data/vXX/connect/proxy/ui-telemetry), so with an org present it is not seen at O11Y_ENDPOINT.
 * But its payload is provably the SAME enriched span: o11ySpanExporter builds
 * { name: span.name, properties: convertAttributes(span.attributes) + identity } from the exact span
 * dumped below. So the span dump IS the O11y payload; only the transport (org proxy) differs.
 * Escape hatch: set O11Y_ENDPOINT to force both paths (OTEL exporter + legacy O11yReporter) to POST
 * directly to that endpoint, skipping the org proxy — see the o11y:debug server on :3002.
 *
 * The legacy class reporters (AppInsights/O11yReporter/TelemetryFile in utils-vscode) are INERT in
 * dev/test (determineReporters returns only TelemetryFile, gated on an undeclared localTelemetryLogging
 * setting) — best-effort dumped at the end, normally empty. Exception: O11Y_ENDPOINT forces the legacy
 * O11yReporter live in dev/test.
 *
 * The fixture flips telemetry.telemetryLevel back to 'all' and launches against a minimal org so
 * org-identity props (orgId, isScratch, orgEdition, …) populate on the enriched root spans.
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

  await test.step('settle: let the AppInsights batch flush the command span while extension is live', async () => {
    // The AppInsights network exporter batches on BatchSpanProcessor's default scheduledDelay (5s) and
    // an immediate reload tears the extension host down before that fires, dropping the async POST to
    // localhost:3003 (the SYNCHRONOUS file exporter still captures). Wait out ~2x the batch delay so
    // the command span is exported to a live capture server. (Diagnostic only; CI runs with no listener.)
    await page.waitForTimeout(10_000);
  });

  await test.step('reload to flush buffered spans + class-telemetry (deactivationEvent)', async () => {
    // Reload ends the extension scopes: services flushes its BatchSpanProcessor buffer to
    // ~/.sf/vscode-spans/*.jsonl, and core's deactivate() calls sendExtensionDeactivationEvent() +
    // dispose(), flushing TelemetryFile's buffer to {workspace}/salesforcedx-vscode-core-telemetry.json.
    await reloadWindow(page);
    await waitForVSCodeWorkbench(page);
  });

  await test.step('dump o11y spans + org-identity attributes', async () => {
    // The default-org ref that stamps org-identity is populated asynchronously (maybeUpdateDefaultOrgRef
    // runs in a forkDaemon after the first connection), and only core's SDK ever connects to the org —
    // lightning's command span never carries orgId. So wait for the orgId-bearing root span (a core span
    // like workspaceOrgShape.getOrgShape) to flush, not merely for any span.
    // Also require telemetryTag 'e2e-test': the union covers every *.jsonl in SPANS_DIR, including
    // spanRedaction.desktop.spec.ts's spans, which plant a different tag on purpose.
    const isThisSpec = (s: SpanRow): boolean =>
      s.attributes?.orgId !== undefined && s.attributes?.telemetryTag === 'e2e-test';
    const rows = await waitFor(
      () => readAllSpanRows(),
      r => r.some(isThisSpec),
      'no orgId-enriched o11y span flushed yet'
    );

    const spanNames = [...new Set(rows.map(s => s.name))].toSorted();
    console.log('=== O11Y SPAN NAMES THIS SESSION ===');
    console.log(JSON.stringify(spanNames, null, 2));

    // Org-identity is enriched ONLY onto ROOT spans by spanTransformProcessor (`!span.parentSpanContext`).
    // Child spans carry no orgId. So target a span that actually has orgId — prefer the command span.
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
    const commandSpan = rows.find(
      s => s.name === 'sf.lightning.generate.aura.component' && s.attributes?.telemetryTag === 'e2e-test'
    );
    // Prefer the command span IF it carries orgId (it does once the default-org ref is populated), else
    // fall back to any orgId-bearing root span of THIS spec (e.g. core's workspaceOrgShape.getOrgShape).
    const enriched = commandSpan?.attributes?.orgId !== undefined ? commandSpan : rows.find(isThisSpec);
    const orgAttrs: Record<string, unknown> = Object.fromEntries(
      orgAttrKeys.map(k => [k, enriched?.attributes?.[k]] as const).filter(([, v]) => v !== undefined)
    );
    console.log('=== O11Y ORG-IDENTITY ATTRIBUTES (from span:', enriched?.name, ') ===');
    console.log(JSON.stringify(orgAttrs, null, 2));

    // The FULL attribute set on this enriched span is exactly what the downstream exporters send. The
    // O11y exporter AND the AppInsights exporter (ApplicationInsightsNodeExporter) both consume the
    // same enriched span (see spansNode.ts); the common.* keys exist for the AppInsights side. In
    // dev/test AppInsights diverts over HTTP to localhost:3003 — run `npm run spans:server
    // -w salesforcedx-vscode-services` to capture the actual Breeze envelopes to ~/.sf/vscode-appinsights/.
    console.log('=== FULL ENRICHED SPAN ATTRIBUTES (what O11y AND AppInsights receive) ===');
    console.log(JSON.stringify(enriched?.attributes, null, 2));

    console.log('=== O11Y COMMAND SPAN (sf.lightning.generate.aura.component) ===');
    console.log(commandSpan ? JSON.stringify(commandSpan, null, 2) : 'not flushed to file this run');

    expect(enriched?.attributes?.telemetryTag, 'e2e spans should carry the telemetry-tag').toBe('e2e-test');
    expect(orgAttrs.orgId, 'org-identity should populate on the enriched root span').toBeDefined();
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
