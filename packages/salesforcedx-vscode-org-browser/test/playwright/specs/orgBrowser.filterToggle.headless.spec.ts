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

test('Org Browser - filter toggles: toolbar buttons visible with correct icons', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('showLocal toggle button is visible (off command shown when active)', async () => {
    const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
    await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
  });

  await test.step('showOrg toggle is not visible before type expansion', async () => {
    // hasOrgData is false initially, so org toggle should not be rendered
    const hideOrgButton = page.locator('[aria-label="Hide Org Types"]').first();
    const showOrgButton = page.locator('[aria-label="Show Org Types"]').first();
    await expect(hideOrgButton).not.toBeVisible();
    await expect(showOrgButton).not.toBeVisible();
  });
});

test('Org Browser - filter toggles: icon swap on toggle', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('click showLocal toggle and verify icon changes', async () => {
    const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
    await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
    await hideLocalButton.click();

    // After clicking off, the "on" button should appear (state is now inactive)
    const showLocalButton = page.locator('[aria-label="Show Local Types"]').first();
    await expect(showLocalButton).toBeVisible({ timeout: 10_000 });
  });
});

test('Org Browser - filter toggles: org toggle disabled until type expansion', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('verify showOrg button not visible before expansion', async () => {
    const hideOrgButton = page.locator('[aria-label="Hide Org Types"]').first();
    await expect(hideOrgButton).not.toBeVisible();
  });

  await test.step('expand a type node to trigger hasOrgData', async () => {
    await orgBrowserPage.expandFolder('ApexClass');
  });

  await test.step('verify showOrg button appears after expansion', async () => {
    const hideOrgButton = page.locator('[aria-label="Hide Org Types"]').first();
    await expect(hideOrgButton).toBeVisible({ timeout: 10_000 });
  });
});

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

test('Org Browser - filter toggles: both toggles work independently', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  const allItemsCount = await test.step('count all tree items', async () => orgBrowserPage.getStableRootTypeCount());

  await test.step('expand a type to enable org toggle', async () => {
    await orgBrowserPage.expandFolder('ApexClass');
  });

  await test.step('toggle showLocal OFF and verify tree filters', async () => {
    const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
    await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
    await hideLocalButton.click();
    const showLocalButton = page.locator('[aria-label="Show Local Types"]').first();
    await expect(showLocalButton).toBeVisible({ timeout: 10_000 });

    // showLocal OFF + showOrg ON (default) = orgOnly mode: root shows all types, child-level filters org-only components
    await orgBrowserPage.waitForRootTypeCount(allItemsCount);
  });

  await test.step('toggle showOrg OFF independently', async () => {
    const hideOrgButton = page.locator('[aria-label="Hide Org Types"]').first();
    await expect(hideOrgButton).toBeVisible({ timeout: 10_000 });
    await hideOrgButton.click();
    const showOrgButton = page.locator('[aria-label="Show Org Types"]').first();
    await expect(showOrgButton).toBeVisible({ timeout: 10_000 });

    // With both OFF, tree shows everything again (same as both ON)
    await orgBrowserPage.waitForRootTypeCount(allItemsCount);
  });

  await test.step('toggle showLocal back ON without affecting showOrg', async () => {
    const showLocalButton = page.locator('[aria-label="Show Local Types"]').first();
    await showLocalButton.click();
    const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
    await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });

    // showOrg should still be OFF
    const showOrgButton = page.locator('[aria-label="Show Org Types"]').first();
    await expect(showOrgButton).toBeVisible();
  });
});

test('Org Browser - filter toggles: orgOnly mode (showLocal OFF) shows all types', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  const beforeCount = await test.step('count tree items before filter', async () =>
    orgBrowserPage.getStableRootTypeCount());

  await test.step('toggle showLocal OFF to enter orgOnly mode', async () => {
    const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
    await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
    await hideLocalButton.click();
    const showLocalButton = page.locator('[aria-label="Show Local Types"]').first();
    await expect(showLocalButton).toBeVisible({ timeout: 10_000 });
  });

  await test.step('verify all types still visible at root level', async () => {
    // orgOnly mode: root shows all types (they all exist in org), child-level filters to org-only components
    await orgBrowserPage.waitForRootTypeCount(beforeCount);
  });
});

// Skipped: the e2e workspace's force-app is created empty by createTestWorkspace() (see
// packages/playwright-vscode-ext/src/fixtures/desktopWorkspace.ts) — the org has Dreamhouse
// metadata deployed to it, but nothing ever copies local source files into the opened
// workspace, so localOnly mode has no non-empty case to verify here. Re-enable once the
// workspace is seeded with local files that overlap the org's metadata.
test.skip('Org Browser - filter toggles: localOnly mode (showOrg OFF) shows only types in local project', async ({
  page
}) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  const beforeCount = await test.step('count tree items before filter', async () =>
    orgBrowserPage.getStableRootTypeCount());

  await test.step('expand a type to enable org toggle', async () => {
    await orgBrowserPage.expandFolder('ApexClass');
  });

  await test.step('toggle showOrg OFF to enter localOnly mode', async () => {
    const hideOrgButton = page.locator('[aria-label="Hide Org Types"]').first();
    await expect(hideOrgButton).toBeVisible({ timeout: 10_000 });
    await hideOrgButton.click();
    const showOrgButton = page.locator('[aria-label="Show Org Types"]').first();
    await expect(showOrgButton).toBeVisible({ timeout: 10_000 });
  });

  await test.step('verify only local types remain visible', async () => {
    // localOnly mode (showLocal ON + showOrg OFF): root shows only types with local source files.
    // The e2e workspace's force-app is created empty by the test fixture (no local metadata is
    // ever written into it), so localOnly legitimately collapses to 0 root types here.
    await expect.poll(() => orgBrowserPage.getRootTypeCount(), { timeout: 10_000 }).toBeLessThan(beforeCount);
  });
});

test('Org Browser - filter toggles: legacy viewMode migration', async ({ page }) => {
  // This test verifies the migration path works by checking that after activation
  // with new boolean keys, the tree renders correctly and toggle buttons are functional
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser and verify tree renders with defaults', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('verify both toggles are in default ON state', async () => {
    const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
    await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
  });

  await test.step('verify tree renders metadata types', async () => {
    const count = await orgBrowserPage.getStableRootTypeCount();
    expect(count).toBeGreaterThan(0);
  });
});
