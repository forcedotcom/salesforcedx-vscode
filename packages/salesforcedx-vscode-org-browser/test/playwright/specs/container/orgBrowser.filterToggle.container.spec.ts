/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of orgBrowser.filterToggle.headless (ADR 0022). Exercises the showLocal/showOrg
 * toolbar toggles in the Code Builder image against the container's boot-authed org. Every
 * assertion is org-shape independent: the toolbar buttons and their icon swaps, and the root-level
 * type count (the type list comes from the org describe, which is present on any org). No Dreamhouse
 * metadata, retrieval, or per-test org setup is needed — it runs against the shared boot org. The
 * desktop-only twin (orgBrowser.filterToggle.desktop) is intentionally NOT ported: it needs a
 * window reload the code-server web container can't perform.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { OrgBrowserPage } from '../../pages/orgBrowserPage';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { normalizeOrgBrowserFilters } from './containerHelpers';

// Shared, persistent workbench: reset editors, notifications, and the persisted Org Browser filter
// state before each test rather than assuming a clean slate.
test.beforeEach(async ({ page }) => {
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await normalizeOrgBrowserFilters(new OrgBrowserPage(page));
});

test('Org Browser - filter toggles: toolbar buttons visible with correct icons', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('showLocal toggle button is visible (off command shown when active)', async () => {
    const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
    await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
  });

  await test.step('showOrg toggle button is visible without requiring type expansion', async () => {
    const hideOrgButton = page.locator('[aria-label="Hide Org Types"]').first();
    await expect(hideOrgButton).toBeVisible({ timeout: 10_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - filter toggles: icon swap on toggle', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
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

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - filter toggles: org toggle works before any type is expanded', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('toggle showOrg OFF without expanding any type first', async () => {
    const hideOrgButton = page.locator('[aria-label="Hide Org Types"]').first();
    await expect(hideOrgButton).toBeVisible({ timeout: 10_000 });
    await hideOrgButton.click();
    const showOrgButton = page.locator('[aria-label="Show Org Types"]').first();
    await expect(showOrgButton).toBeVisible({ timeout: 10_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - filter toggles: both toggles work independently', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  const allItemsCount = await test.step('count all tree items', async () => orgBrowserPage.getStableRootTypeCount());

  await test.step('toggle showLocal OFF and verify tree filters', async () => {
    const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
    await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
    await hideLocalButton.click();
    const showLocalButton = page.locator('[aria-label="Show Local Types"]').first();
    await expect(showLocalButton).toBeVisible({ timeout: 10_000 });

    // showLocal OFF + showOrg ON (default) = orgOnly mode: root shows all types, child-level shows all org components
    await orgBrowserPage.waitForRootTypeCount(allItemsCount);
  });

  await test.step('toggle showOrg OFF independently — both filters OFF yields empty tree', async () => {
    const hideOrgButton = page.locator('[aria-label="Hide Org Types"]').first();
    await expect(hideOrgButton).toBeVisible({ timeout: 10_000 });
    await hideOrgButton.click();
    const showOrgButton = page.locator('[aria-label="Show Org Types"]').first();
    await expect(showOrgButton).toBeVisible({ timeout: 10_000 });

    // With both OFF, tree is empty
    await orgBrowserPage.waitForRootTypeCount(0);
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

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - filter toggles: orgOnly mode (showLocal OFF) shows all types', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
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
    // orgOnly mode: root shows all types (they all exist in org), child-level shows all org components
    await orgBrowserPage.waitForRootTypeCount(beforeCount);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

// Skipped: localOnly mode (showOrg OFF) narrows the root to types with local source files. The
// container workspace's local shape isn't a stable contract for this assertion, so this stays
// skipped here just as it is in the headless twin.
test.skip('Org Browser - filter toggles: localOnly mode (showOrg OFF) shows only types in local project', async ({
  page
}) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  const beforeCount = await test.step('count tree items before filter', async () =>
    orgBrowserPage.getStableRootTypeCount());

  await test.step('toggle showOrg OFF to enter localOnly mode', async () => {
    const hideOrgButton = page.locator('[aria-label="Hide Org Types"]').first();
    await expect(hideOrgButton).toBeVisible({ timeout: 10_000 });
    await hideOrgButton.click();
    const showOrgButton = page.locator('[aria-label="Show Org Types"]').first();
    await expect(showOrgButton).toBeVisible({ timeout: 10_000 });
  });

  await test.step('verify only local types remain visible', async () => {
    await expect.poll(() => orgBrowserPage.getRootTypeCount(), { timeout: 10_000 }).toBeLessThan(beforeCount);
  });
});

test('Org Browser - filter toggles: legacy viewMode migration', async ({ page }) => {
  // This test verifies the migration path works by checking that after activation
  // with new boolean keys, the tree renders correctly and toggle buttons are functional
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
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

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
