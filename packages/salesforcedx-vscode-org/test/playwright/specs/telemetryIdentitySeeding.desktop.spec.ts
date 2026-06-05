/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { orgDesktopWithOrgTest as test } from '../fixtures/orgDesktopWithOrgFixtures';

const SPANS_DIR = path.join(os.homedir(), '.sf', 'vscode-spans');

const readNewestSpansFile = async (): Promise<string | undefined> => {
  const entries = await fs.readdir(SPANS_DIR).catch(() => [] as string[]);
  const jsonl = entries
    .filter(name => name.endsWith('.jsonl'))
    .toSorted()
    .toReversed();
  if (jsonl.length === 0) return undefined;
  return fs.readFile(path.join(SPANS_DIR, jsonl[0]), 'utf-8');
};

test('services seeds cliId + webUserId on activation; spans carry both dimensions', async ({ page }) => {
  test.setTimeout(180_000);

  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);

  await executeCommandWithCommandPalette(page, packageNls.config_set_org_text);

  // Allow span dump to flush
  await page.waitForTimeout(5000);

  const contents = await readNewestSpansFile();
  expect(contents).toBeDefined();
  const lines = (contents ?? '').split('\n').filter(Boolean);
  expect(lines.length).toBeGreaterThan(0);
  const spans = lines.map(l => JSON.parse(l) as { attributes?: Record<string, unknown> });
  const matching = spans.find(
    s =>
      s.attributes &&
      typeof s.attributes['cliId'] === 'string' &&
      (s.attributes['cliId'] as string).length > 0 &&
      typeof s.attributes['webUserId'] === 'string'
  );
  expect(matching).toBeDefined();
});
