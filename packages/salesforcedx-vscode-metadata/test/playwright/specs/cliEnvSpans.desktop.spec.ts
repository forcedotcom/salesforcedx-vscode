/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * TerminalService gathers the sf CLI env (SF_LOG_LEVEL / NODE_EXTRA_CA_CERTS / SF_DISABLE_TELEMETRY) at
 * exec time rather than having it pushed once at activation. This spec proves that end to end against a
 * real `sf` child: `SFDX: Generate Project Info` runs `sf --version` (an sf command) and `java --version`
 * (not an sf command) through the same simpleExec, and each exec annotates its span with `envKeys`.
 *
 * Lives in metadata because projectInfo is the only desktop command that runs both kinds of exec in one flow.
 */

import { expect } from '@playwright/test';
import {
  closeSettingsTab,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  isDesktop,
  readAllSpanRows,
  saveScreenshot,
  upsertSettings,
  verifyCommandExists,
  waitForSpanRows,
  waitForVSCodeWorkbench,
  NOTIFICATION_LIST_ITEM,
  type SpanRow
} from '@salesforce/playwright-vscode-ext';
import { isString } from 'effect/Predicate';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { desktopTest as test } from '../fixtures';

// every key an `sf ` exec should carry once telemetry is off (the fixture sets telemetry.telemetryLevel: 'off')
const GATHERED_ENV_KEYS = ['SF_LOG_LEVEL', 'SF_DISABLE_TELEMETRY', 'SF_JSON_TO_STDOUT', 'FORCE_COLOR', 'SFDX_TOOL'];

/** simpleExec children of an in-window gatherEnvironment span. The command attribute is deliberately absent,
 * so use the parent operation for identity. The spans dir is shared with earlier runs and parallel workers;
 * trace + span IDs keep unrelated simpleExec spans out without inspecting command input. */
const simpleExecRowsSince = (baselineNanos: bigint) => async (): Promise<SpanRow[]> => {
  const rows = await readAllSpanRows();
  const parentIds = new Set(
    rows
      .filter(
        row =>
          row.kind === 'span' &&
          row.name === 'gatherEnvironment' &&
          isString(row.traceId) &&
          isString(row.spanId) &&
          BigInt(row.startTimeUnixNano ?? '0') > baselineNanos
      )
      .map(row => `${row.traceId}:${row.spanId}`)
  );

  return rows.filter(
    row =>
      row.kind === 'span' &&
      row.name === 'TerminalService.simpleExec' &&
      isString(row.traceId) &&
      isString(row.parentSpanId) &&
      parentIds.has(`${row.traceId}:${row.parentSpanId}`) &&
      BigInt(row.startTimeUnixNano ?? '0') > baselineNanos
  );
};

/** effect's OTel tracer runs non-primitive attribute values through Inspectable.toStringUnknown
 * (JSON.stringify(value, null, 2)), so the annotated array reaches the span file as JSON text
 * (node_modules/@effect/opentelemetry/dist/cjs/internal/utils.js:22-29). Tolerate both shapes. */
const envKeysOf = (row: SpanRow): readonly string[] => {
  const keys = row.attributes?.envKeys;
  return isString(keys) ? (JSON.parse(keys) as string[]) : Array.isArray(keys) ? keys.map(String) : [];
};

const nowNanos = (): bigint => BigInt(Date.now()) * 1_000_000n;

(isDesktop() ? test : test.skip.bind(test))('CLI env: sf commands pick up settings at exec time', async ({ page }) => {
  test.setTimeout(300_000);
  const firstRun = nowNanos();
  const caCertsPath = path.join(os.tmpdir(), `cli-env-spans-${Date.now()}.pem`);

  await test.step('open the workspace and verify the command exists', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await verifyCommandExists(page, packageNls.project_info_text, 120_000);
  });

  await test.step('run Generate Project Info', async () => {
    await executeCommandWithCommandPalette(page, packageNls.project_info_text);
    const notification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: messages.project_info_written_message })
      .first();
    await expect(notification, 'Project info notification should be visible').toBeVisible({ timeout: 120_000 });
    await saveScreenshot(page, 'cliEnvSpans.01-report-written.png');
  });

  const firstRunSfRows = await test.step('the sf child gets the gathered env; the non-sf child gets none', async () => {
    const rows = await waitForSpanRows(
      simpleExecRowsSince(firstRun),
      candidates =>
        candidates.some(row => GATHERED_ENV_KEYS.every(key => envKeysOf(row).includes(key))) &&
        candidates.some(row => row.attributes?.envKeys === undefined),
      `gatherEnvironment simpleExec children with and without ${GATHERED_ENV_KEYS.join(', ')}`
    );

    expect(
      rows.every(row => row.attributes?.command === undefined),
      'simpleExec spans should not carry the raw command'
    ).toBe(true);
    expect(
      rows.some(row => row.attributes?.envKeys === undefined),
      'one gatherEnvironment child should carry no envKeys'
    ).toBe(true);
    return rows.filter(row => GATHERED_ENV_KEYS.every(key => envKeysOf(row).includes(key)));
  });

  // The setting legitimately falls back to the ambient NODE_EXTRA_CA_CERTS, and VS Code hands the extension
  // host the environment it resolves from the user's login shell — so a corp-proxy machine that exports the
  // var from its shell profile already carries the key, no matter what this process's env says. Read that
  // from the spans instead of process.env, and only assert the "absent before" half when it truly is absent.
  const ambientCaCerts = firstRunSfRows.some(row => envKeysOf(row).includes('NODE_EXTRA_CA_CERTS'));
  if (!ambientCaCerts) {
    await test.step('NODE_EXTRA_CA_CERTS is absent before the setting is written', async () => {
      // re-read: another window can have added in-window rows since the poll above returned
      const rows = await simpleExecRowsSince(firstRun)();
      expect(
        rows.some(row => envKeysOf(row).includes('NODE_EXTRA_CA_CERTS')),
        'no in-window sf span should carry NODE_EXTRA_CA_CERTS yet'
      ).toBe(false);
    });
  }

  await test.step('write the NODE_EXTRA_CA_CERTS setting (no window reload)', async () => {
    // content is irrelevant: envKeys is annotated before exec, and projectInfo orElseSucceeds a failed
    // `sf --version`
    await fs.writeFile(caCertsPath, '# placeholder, not a real PEM\n');
    // writing through the Settings UI also proves the moved key is still registered as a setting
    await upsertSettings(page, { 'salesforcedx-vscode-core.NODE_EXTRA_CA_CERTS': caCertsPath });
    await closeSettingsTab(page);
    await saveScreenshot(page, 'cliEnvSpans.02-setting-written.png');
  });

  // key presence can only prove pickup when it was absent before: an ambient NODE_EXTRA_CA_CERTS already
  // puts the key on every span (the setting falls back to it), which would make this assertion vacuous. The
  // value can't be asserted instead — simpleExec annotates env keys only, never values.
  if (!ambientCaCerts) {
    await test.step('the next command picks the new setting up with no reload', async () => {
      const secondRun = nowNanos();
      await executeCommandWithCommandPalette(page, packageNls.project_info_text);
      await waitForSpanRows(
        simpleExecRowsSince(secondRun),
        rows => rows.some(row => envKeysOf(row).includes('NODE_EXTRA_CA_CERTS')),
        'a gatherEnvironment simpleExec child whose envKeys include NODE_EXTRA_CA_CERTS'
      );
    });
  }
});
