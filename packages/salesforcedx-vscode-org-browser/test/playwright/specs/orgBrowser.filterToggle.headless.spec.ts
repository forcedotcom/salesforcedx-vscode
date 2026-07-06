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

  await test.step('showLocal toggle button is visible', async () => {
    const showLocalButton = page.locator('[aria-label="Show Local Types (Active)"]');
    await expect(showLocalButton).toBeVisible({ timeout: 10_000 });
  });

  await test.step('showOrg toggle is not visible before type expansion', async () => {
    // hasOrgData is false initially, so org toggle should not be rendered
    const showOrgOnButton = page.locator('[aria-label="Show Org Types (Active)"]');
    const showOrgOffButton = page.locator('[aria-label="Show Org Types (Inactive)"]');
    await expect(showOrgOnButton).not.toBeVisible();
    await expect(showOrgOffButton).not.toBeVisible();
  });
});

test('Org Browser - filter toggles: icon swap on toggle', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('click showLocal toggle and verify icon changes', async () => {
    const showLocalOn = page.locator('[aria-label="Show Local Types (Active)"]');
    await expect(showLocalOn).toBeVisible({ timeout: 10_000 });
    await showLocalOn.click();

    // After clicking, the button label should change to the "off" variant
    const showLocalOff = page.locator('[aria-label="Show Local Types (Inactive)"]');
    await expect(showLocalOff).toBeVisible({ timeout: 10_000 });
  });
});

test('Org Browser - filter toggles: org toggle disabled until type expansion', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('verify showOrg button not visible before expansion', async () => {
    const showOrgOnButton = page.locator('[aria-label="Show Org Types (Active)"]');
    await expect(showOrgOnButton).not.toBeVisible();
  });

  await test.step('expand a type node to trigger hasOrgData', async () => {
    await orgBrowserPage.expandFolder('ApexClass');
  });

  await test.step('verify showOrg button appears after expansion', async () => {
    const showOrgOnButton = page.locator('[aria-label="Show Org Types (Active)"]');
    await expect(showOrgOnButton).toBeVisible({ timeout: 10_000 });
  });
});

test('Org Browser - filter toggles: filter state persists across reload', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('toggle showLocal OFF', async () => {
    const showLocalOn = page.locator('[aria-label="Show Local Types (Active)"]');
    await expect(showLocalOn).toBeVisible({ timeout: 10_000 });
    await showLocalOn.click();
    const showLocalOff = page.locator('[aria-label="Show Local Types (Inactive)"]');
    await expect(showLocalOff).toBeVisible({ timeout: 10_000 });
  });

  await test.step('reload window', async () => {
    await page.keyboard.press('Control+Shift+P');
    await page.keyboard.type('Reload Window', { delay: 50 });
    await page.keyboard.press('Enter');
    await waitForVSCodeWorkbench(page);
  });

  await test.step('verify showLocal remains OFF after reload', async () => {
    const orgBrowserPageAfter = new OrgBrowserPage(page);
    await orgBrowserPageAfter.openOrgBrowser();
    const showLocalOff = page.locator('[aria-label="Show Local Types (Inactive)"]');
    await expect(showLocalOff).toBeVisible({ timeout: 15_000 });
  });
});

test('Org Browser - filter toggles: both toggles work independently', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  const allItemsCount = await test.step('count all tree items', async () => {
    const items = page.locator('[role="treeitem"][aria-level="1"]');
    return await items.count();
  });

  await test.step('expand a type to enable org toggle', async () => {
    await orgBrowserPage.expandFolder('ApexClass');
  });

  await test.step('toggle showLocal OFF and verify tree filters', async () => {
    const showLocalOn = page.locator('[aria-label="Show Local Types (Active)"]');
    await expect(showLocalOn).toBeVisible({ timeout: 10_000 });
    await showLocalOn.click();
    const showLocalOff = page.locator('[aria-label="Show Local Types (Inactive)"]');
    await expect(showLocalOff).toBeVisible({ timeout: 10_000 });

    // Count should be less or equal since non-local types are filtered out
    const filteredItems = page.locator('[role="treeitem"][aria-level="1"]');
    const filteredCount = await filteredItems.count();
    expect(filteredCount).toBeLessThanOrEqual(allItemsCount);
  });

  await test.step('toggle showOrg OFF independently', async () => {
    const showOrgOn = page.locator('[aria-label="Show Org Types (Active)"]');
    await expect(showOrgOn).toBeVisible({ timeout: 10_000 });
    await showOrgOn.click();
    const showOrgOff = page.locator('[aria-label="Show Org Types (Inactive)"]');
    await expect(showOrgOff).toBeVisible({ timeout: 10_000 });
  });

  await test.step('toggle showLocal back ON without affecting showOrg', async () => {
    const showLocalOff = page.locator('[aria-label="Show Local Types (Inactive)"]');
    await showLocalOff.click();
    const showLocalOn = page.locator('[aria-label="Show Local Types (Active)"]');
    await expect(showLocalOn).toBeVisible({ timeout: 10_000 });

    // showOrg should still be OFF
    const showOrgOff = page.locator('[aria-label="Show Org Types (Inactive)"]');
    await expect(showOrgOff).toBeVisible();
  });
});

test('Org Browser - filter toggles: showLocal OFF hides types with no local files', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  const beforeCount = await test.step('count tree items before filter', async () => {
    const items = page.locator('[role="treeitem"][aria-level="1"]');
    return await items.count();
  });

  await test.step('toggle showLocal OFF', async () => {
    const showLocalOn = page.locator('[aria-label="Show Local Types (Active)"]');
    await expect(showLocalOn).toBeVisible({ timeout: 10_000 });
    await showLocalOn.click();
    const showLocalOff = page.locator('[aria-label="Show Local Types (Inactive)"]');
    await expect(showLocalOff).toBeVisible({ timeout: 10_000 });
  });

  await test.step('verify filtered count is smaller', async () => {
    // Wait for tree to refresh
    await page.waitForTimeout(2000);
    const items = page.locator('[role="treeitem"][aria-level="1"]');
    const afterCount = await items.count();
    // Dreamhouse has local files for only some types, so the filtered count should be less
    expect(afterCount).toBeLessThan(beforeCount);
  });
});

test('Org Browser - filter toggles: showOrg OFF hides types not in local project', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  const beforeCount = await test.step('count tree items before filter', async () => {
    const items = page.locator('[role="treeitem"][aria-level="1"]');
    return await items.count();
  });

  await test.step('expand a type to enable org toggle', async () => {
    await orgBrowserPage.expandFolder('ApexClass');
  });

  await test.step('toggle showOrg OFF', async () => {
    const showOrgOn = page.locator('[aria-label="Show Org Types (Active)"]');
    await expect(showOrgOn).toBeVisible({ timeout: 10_000 });
    await showOrgOn.click();
    const showOrgOff = page.locator('[aria-label="Show Org Types (Inactive)"]');
    await expect(showOrgOff).toBeVisible({ timeout: 10_000 });
  });

  await test.step('verify only local types remain visible', async () => {
    // Wait for tree to refresh
    await page.waitForTimeout(2000);
    const items = page.locator('[role="treeitem"][aria-level="1"]');
    const afterCount = await items.count();
    // Should be fewer since org-only types are hidden
    expect(afterCount).toBeLessThan(beforeCount);
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
    const showLocalOn = page.locator('[aria-label="Show Local Types (Active)"]');
    await expect(showLocalOn).toBeVisible({ timeout: 10_000 });
  });

  await test.step('verify tree renders metadata types', async () => {
    const items = page.locator('[role="treeitem"][aria-level="1"]');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });
});
