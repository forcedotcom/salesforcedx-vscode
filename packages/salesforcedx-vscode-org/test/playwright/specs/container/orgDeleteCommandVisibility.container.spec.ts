/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of orgDeleteCommandVisibility.desktop (see
 * docs/adr/0022-code-builder-e2e-desktop-build-over-browser.md). Runs against the single shared
 * container fixture + the one tracking scratch org authed as the default target-org at boot — no org
 * creation here. A scratch org is a deletable default (isScratch === true) so sf:default_org_deletable
 * is set and `SFDX: Delete Default Org` must appear in the palette. This asserts visibility only; it
 * does NOT run the command / delete the shared boot org. The negative (hidden) case needs a
 * non-scratch default and is covered by the updateContext jest test.
 */

import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';

// Shared persistent workbench: reset editor + notification state before each test rather than
// assuming a clean slate.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('org extension (Code Builder): SFDX: Delete Default Org is visible when the default org is a scratch org', async ({
  page
}) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'orgDeleteCommandVisibility.container.01-ready.png');
  });

  // Gate on an always-present activation command so we don't get a false negative on slow startup.
  await test.step('verify extension-activated command is present', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('verify Delete Default Org is visible (do not run it)', async () => {
    // Visibility assertion only — the shared boot org must survive for other specs.
    await verifyCommandExists(page, packageNls.org_delete_default_text, 30_000);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
