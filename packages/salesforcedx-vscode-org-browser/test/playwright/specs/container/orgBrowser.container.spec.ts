/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the Org Browser (ADR 0022). The web twins (orgBrowser.*.headless.spec.ts)
 * cover retrieval against Dreamhouse metadata; this container spec asserts the org-light half that
 * proves the browser works in the Code Builder image: opening it lists the org's metadata types
 * (a live describe against the container's boot-authed org) and a universal type (`ApexClass`,
 * present on every org) resolves at the tree root. No custom metadata or retrieval needed, so it
 * runs against the container's minimal org and writes nothing into the shared fixture.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { OrgBrowserPage } from '../../pages/orgBrowserPage';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('Org Browser (Code Builder): lists org metadata types', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('open the Org Browser (asserts the org describe loaded ≥5 types)', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('a universal metadata type resolves at the tree root', async () => {
    const apexClassType = await orgBrowserPage.findMetadataType('ApexClass');
    await expect(apexClassType).toHaveRole('treeitem');
    await expect(apexClassType).toHaveAttribute('aria-level', '1');
    await saveScreenshot(page, 'orgBrowser.container.01-types-loaded.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
