/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test } from '../fixtures';
import { expect } from '@playwright/test';
import { OrgBrowserPage } from '../pages/orgBrowserPage';
import {
  closeWelcomeTabs,
  createDreamhouseOrg,
  ensureSecondarySideBarHidden,
  reloadWindow,
  upsertScratchOrgAuthFieldsToSettings,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';

test.setTimeout(600_000);

test.beforeEach(async ({ page }) => {
  const createResult = await createDreamhouseOrg();
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowserPage.waitForProject());
  await ensureSecondarySideBarHidden(page);
});

// Desktop-only: `Developer: Reload Window` does a full page reload in VS Code web, which
// re-fetches extension bundles from the dev web server — a source of flakiness unrelated to
// what this test verifies (workspaceState persistence across extension deactivate/reactivate).
// Desktop (Electron) reloads reliably, so it covers the persistence behavior without that risk.
test('Org Browser - filter toggles: filter state persists across reload', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('toggle showLocal OFF', async () => {
    const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
    await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
    await hideLocalButton.click();
    const showLocalButton = page.locator('[aria-label="Show Local Types"]').first();
    await expect(showLocalButton).toBeVisible({ timeout: 10_000 });
  });

  await test.step('reload window', async () => {
    await reloadWindow(page);
    await waitForVSCodeWorkbench(page);
  });

  await test.step('verify showLocal remains OFF after reload', async () => {
    const orgBrowserPageAfter = new OrgBrowserPage(page);
    await orgBrowserPageAfter.openOrgBrowser();
    const showLocalButton = page.locator('[aria-label="Show Local Types"]').first();
    await expect(showLocalButton).toBeVisible({ timeout: 15_000 });
  });
});
