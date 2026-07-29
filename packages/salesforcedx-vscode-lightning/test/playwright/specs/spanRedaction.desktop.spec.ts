/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Proves RedactingSpanProcessor scrubs a real secret out of BOTH egress files, not just in unit tests:
 *
 *   1. ~/.sf/vscode-spans/*.jsonl                    — OTLP file exporter (local sink, redacted too)
 *   2. ~/.sf/vscode-appinsights/appinsights-*.jsonl  — Breeze envelopes captured off the AppInsights
 *                                                      transport, which dev/test diverts to :3003
 *
 * (2) needs the capture server, which wireit starts for the run: lightning's `test:desktop` depends on
 * `../salesforcedx-vscode-services:spans:server` (a `service: true` script).
 *
 * The vector is `salesforcedx-vscode-core.telemetry-tag` set to an access-token-shaped value (see
 * redactionFixtures): spanTransformProcessor stamps it on every root span, and the Azure exporter
 * copies span attributes into `data.baseData.properties`. One planted value, both files, no org and no
 * failing command needed. status.message / exception events cannot be planted deterministically from
 * e2e — those paths are covered by test/jest/observability/redactingSpanProcessor.test.ts.
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
  readJsonlFiles,
  parseJsonlLines,
  EDITOR_WITH_URI,
  QUICK_INPUT_WIDGET,
  type SpanRow
} from '@salesforce/playwright-vscode-ext';
import * as os from 'node:os';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { redactionDesktopTest as test, PLANTED_TOKEN_TAIL } from '../fixtures/redactionFixtures';

const SPANS_DIR = path.join(os.homedir(), '.sf', 'vscode-spans');
const APPINSIGHTS_DIR = path.join(os.homedir(), '.sf', 'vscode-appinsights');
const REDACTED = '<REDACTED ACCESS TOKEN>';

type Envelope = { data?: { baseData?: { properties?: Record<string, unknown> } } };

test('redact: planted access token -> <REDACTED ACCESS TOKEN> in span + AppInsights files', async ({ page }) => {
  test.setTimeout(360_000);
  const since = Date.now();

  await test.step('workbench ready', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  await test.step('run a local, org-free command to produce a root command span', async () => {
    const command = packageNls.lightning_generate_aura_component_text;
    await verifyCommandExists(page, command, 60_000);
    await executeCommandWithCommandPalette(page, command);

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type('RedactionProbeCmp');
    await page.keyboard.press('Enter');
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');

    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 30_000 });
  });

  await test.step('settle: let the AppInsights batch POST while the extension host is alive', async () => {
    // BatchSpanProcessor's default scheduledDelay is 5s and an immediate reload tears the host down
    // before it fires, dropping the async POST to localhost:3003. The file exporter is synchronous.
    await page.waitForTimeout(10_000);
  });

  await test.step('reload to flush the remaining buffered spans', async () => {
    await reloadWindow(page);
    await waitForVSCodeWorkbench(page);
  });

  await test.step('span file: telemetryTag redacted, raw token absent', async () => {
    await expect
      .poll(
        async () => {
          const files = await readJsonlFiles(SPANS_DIR, since);
          return parseJsonlLines<SpanRow>(files).some(
            row => row.kind === 'span' && row.attributes?.telemetryTag === REDACTED
          );
        },
        { timeout: 90_000, message: 'no span with a redacted telemetryTag reached ~/.sf/vscode-spans' }
      )
      .toBe(true);

    const raw = (await readJsonlFiles(SPANS_DIR, since)).join('\n');
    expect(raw, 'raw planted token leaked into the span file').not.toContain(PLANTED_TOKEN_TAIL);
  });

  await test.step('AppInsights envelopes: telemetryTag redacted, raw token absent', async () => {
    await expect
      .poll(
        async () => {
          const files = await readJsonlFiles(APPINSIGHTS_DIR, since);
          return parseJsonlLines<Envelope>(files).some(
            envelope => envelope.data?.baseData?.properties?.telemetryTag === REDACTED
          );
        },
        {
          timeout: 90_000,
          message: `no envelope with a redacted telemetryTag reached ${APPINSIGHTS_DIR} — is the spans:server wireit service running?`
        }
      )
      .toBe(true);

    const raw = (await readJsonlFiles(APPINSIGHTS_DIR, since)).join('\n');
    expect(raw, 'raw planted token leaked into the AppInsights envelopes').not.toContain(PLANTED_TOKEN_TAIL);
  });

  // No validateNoCriticalErrors: enabling telemetry surfaces unrelated reporter network noise.
});
