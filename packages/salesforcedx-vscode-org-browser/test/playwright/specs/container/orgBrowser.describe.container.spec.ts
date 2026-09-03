/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of orgBrowser.describe.scratch (ADR 0022). Proves the Org Browser's live metadata
 * describe works in the Code Builder image against the container's boot-authed org: opening the
 * browser lists the org's metadata types and a handful of universal, standard types
 * (CustomObject / StaticResource / CustomTab) resolve at the tree root with their per-type toolbar.
 * These types come from the org's describe and exist on every org, so no Dreamhouse metadata,
 * retrieval, or per-test org setup is needed — it runs against the shared boot org.
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

test('Org Browser (Code Builder): high-level validation of a few standard types from describe', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser (asserts the org describe loaded ≥5 types)', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('validate CustomObject', async () => {
    await orgBrowserPage.findMetadataType('CustomObject');
  });

  await test.step('validate StaticResource', async () => {
    // pick a node that will scroll a bit
    await orgBrowserPage.findMetadataType('StaticResource');
  });

  const tabType = await orgBrowserPage.findMetadataType('CustomTab');

  await test.step('CustomTab UI (not expanded)', async () => {
    await tabType.hover();
    await expect(tabType).toBeVisible();
    // Expected structure: treeitem at level 1 with toolbar containing both Refresh Type and Retrieve Metadata buttons
    await expect(tabType).toHaveRole('treeitem');
    await expect(tabType).toHaveAttribute('aria-level', '1');
    await expect(tabType.locator('[aria-label="Refresh Type"]')).toBeVisible();
    await expect(tabType.locator('[aria-label="Retrieve Metadata"]')).toBeVisible();
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
