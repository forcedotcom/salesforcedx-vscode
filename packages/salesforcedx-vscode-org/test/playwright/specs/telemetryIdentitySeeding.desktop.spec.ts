/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Schedule from 'effect/Schedule';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { orgDesktopWithOrgTest as test } from '../fixtures/orgDesktopWithOrgFixtures';

const SPANS_DIR = path.join(os.homedir(), '.sf', 'vscode-spans');

type SpanRow = { attributes?: Record<string, unknown> };

const readNewestSpansFile = async (): Promise<string | undefined> => {
  const entries = await fs.readdir(SPANS_DIR).catch(() => [] as string[]);
  const jsonl = entries
    .filter(name => name.endsWith('.jsonl'))
    .toSorted()
    .toReversed();
  if (jsonl.length === 0) return undefined;
  return fs.readFile(path.join(SPANS_DIR, jsonl[0]), 'utf-8');
};

const findSeededSpan = (contents: string | undefined): SpanRow | undefined => {
  const lines = (contents ?? '').split('\n').filter(Boolean);
  if (lines.length === 0) return undefined;
  return (lines.map(l => JSON.parse(l) as SpanRow) as SpanRow[]).find(
    s =>
      s.attributes !== undefined &&
      typeof s.attributes['cliId'] === 'string' &&
      (s.attributes['cliId'] as string).length > 0 &&
      typeof s.attributes['webUserId'] === 'string'
  );
};

class SpanNotReadyError extends Data.TaggedError('SpanNotReadyError') {}

const waitForSeededSpan = (timeout: Duration.DurationInput): Promise<SpanRow> =>
  Effect.runPromise(
    Effect.tryPromise({
      try: async () => {
        const seeded = findSeededSpan(await readNewestSpansFile());
        if (!seeded) throw new SpanNotReadyError();
        return seeded;
      },
      catch: () => new SpanNotReadyError()
    }).pipe(Effect.retry(Schedule.spaced(Duration.seconds(1))), Effect.timeout(timeout))
  );

test('services seeds cliId + webUserId on activation; spans carry both dimensions', async ({ page }) => {
  test.setTimeout(180_000);

  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);

  // `config_set_org_text` ("SFDX: Set a Default Org") maps to `sf.set.default.org`, which opens the org
  // picker (a modal showQuickPick). Running it activates the org extension and the services extension
  // (the picker effect yields the services API before rendering), which seeds the telemetry identities.
  // We only need activation, not a default-org change, so dismiss the picker with Escape so the modal
  // doesn't hang the spec.
  await executeCommandWithCommandPalette(page, packageNls.config_set_org_text);
  await activeQuickInputWidget(page).waitFor({ state: 'visible', timeout: 30_000 });
  await page.keyboard.press('Escape');

  const matching = await waitForSeededSpan(Duration.seconds(60));
  expect(matching).toBeDefined();
});
