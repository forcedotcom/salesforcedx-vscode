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
  saveScreenshot,
  upsertSettings,
  verifyCommandExists,
  waitForVSCodeWorkbench,
  NOTIFICATION_LIST_ITEM
} from '@salesforce/playwright-vscode-ext';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { desktopTest as test } from '../fixtures';

const SPANS_DIR = path.join(os.homedir(), '.sf', 'vscode-spans');

// every key an `sf ` exec should carry once telemetry is off (the fixture sets telemetry.telemetryLevel: 'off')
const GATHERED_ENV_KEYS = ['SF_LOG_LEVEL', 'SF_DISABLE_TELEMETRY', 'SF_JSON_TO_STDOUT', 'FORCE_COLOR', 'SFDX_TOOL'];

type SpanRow = { kind?: string; name?: string; startTimeUnixNano?: string; attributes?: Record<string, unknown> };

// Each extension bundles its own services SDK and writes its OWN timestamped jsonl, so read the union of
// all of them rather than guessing a single newest file.
const readAllSpanRows = async (): Promise<SpanRow[]> => {
  const entries = await fs.readdir(SPANS_DIR).catch(() => [] as string[]);
  const perFile = await Promise.all(
    entries
      .filter(name => name.endsWith('.jsonl'))
      .map(async file => {
        const contents = await fs.readFile(path.join(SPANS_DIR, file), 'utf-8').catch(() => '');
        return contents
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line) as SpanRow);
      })
  );
  return perFile.flat();
};

/** simpleExec spans for one command, restricted to this window by start time (startTimeUnixNano is epoch
 * nanos). The spans dir is shared with earlier runs AND with parallel workers, so assert "some in-window
 * row satisfies X" — never "the newest matching row", which another Electron can win. */
const simpleExecRowsSince = (baselineNanos: bigint, command: string) => async (): Promise<SpanRow[]> =>
  (await readAllSpanRows()).filter(
    row =>
      row.kind === 'span' &&
      row.name === 'TerminalService.simpleExec' &&
      row.attributes?.command === command &&
      BigInt(row.startTimeUnixNano ?? '0') > baselineNanos
  );

/** effect's OTel tracer runs non-primitive attribute values through Inspectable.toStringUnknown
 * (JSON.stringify(value, null, 2)), so the annotated array reaches the span file as JSON text
 * (node_modules/@effect/opentelemetry/dist/cjs/internal/utils.js:22-29). Tolerate both shapes. */
const envKeysOf = (row: SpanRow): readonly string[] => {
  const keys = row.attributes?.envKeys;
  return isString(keys) ? (JSON.parse(keys) as string[]) : Array.isArray(keys) ? keys.map(String) : [];
};

class SpansNotReadyError extends Data.TaggedError('SpansNotReadyError')<{ readonly message: string }> {}

/** Poll `read` until `predicate` holds. BatchSpanProcessor buffers, so the rows appear a flush interval
 * after the command finishes. */
const waitForRows = (read: () => Promise<SpanRow[]>, predicate: (rows: SpanRow[]) => boolean, message: string) =>
  Effect.runPromise(
    Effect.tryPromise({
      try: async () => {
        const rows = await read();
        if (!predicate(rows)) throw new SpansNotReadyError({ message });
        return rows;
      },
      catch: () => new SpansNotReadyError({ message })
    }).pipe(Effect.retry(Schedule.spaced(Duration.seconds(1))), Effect.timeout(Duration.seconds(90)))
  );

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
    const sfRows = await waitForRows(
      simpleExecRowsSince(firstRun, 'sf --version'),
      rows => rows.some(row => GATHERED_ENV_KEYS.every(key => envKeysOf(row).includes(key))),
      `an sf --version simpleExec span whose envKeys include ${GATHERED_ENV_KEYS.join(', ')}`
    );

    const javaRows = await waitForRows(
      simpleExecRowsSince(firstRun, 'java --version'),
      rows => rows.length > 0,
      'a java --version simpleExec span'
    );
    // non-sf commands get nothing gathered, so the attribute is absent entirely
    expect(
      javaRows.every(row => row.attributes?.envKeys === undefined),
      'java --version spans should carry no envKeys'
    ).toBe(true);
    return sfRows;
  });

  // The setting legitimately falls back to the ambient NODE_EXTRA_CA_CERTS, and VS Code hands the extension
  // host the environment it resolves from the user's login shell — so a corp-proxy machine that exports the
  // var from its shell profile already carries the key, no matter what this process's env says. Read that
  // from the spans instead of process.env, and only assert the "absent before" half when it truly is absent.
  const ambientCaCerts = firstRunSfRows.some(row => envKeysOf(row).includes('NODE_EXTRA_CA_CERTS'));
  if (!ambientCaCerts) {
    await test.step('NODE_EXTRA_CA_CERTS is absent before the setting is written', async () => {
      // re-read: another window can have added in-window rows since the poll above returned
      const rows = await simpleExecRowsSince(firstRun, 'sf --version')();
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

  await test.step('the next command picks the new setting up with no reload', async () => {
    const secondRun = nowNanos();
    await executeCommandWithCommandPalette(page, packageNls.project_info_text);
    await waitForRows(
      simpleExecRowsSince(secondRun, 'sf --version'),
      rows => rows.some(row => envKeysOf(row).includes('NODE_EXTRA_CA_CERTS')),
      'an sf --version simpleExec span whose envKeys include NODE_EXTRA_CA_CERTS'
    );
  });
});
