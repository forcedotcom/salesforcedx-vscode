/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of orgCommands.desktop (see docs/adr/0022-code-builder-e2e-desktop-build-over-browser.md).
 * Palette command-presence only: proves the org extension activated in the container and its core org
 * commands register in the command palette when the shared fixture project is open. Org-free — no boot
 * org interaction required.
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

test('org extension (Code Builder): SFDX org commands appear in palette when project is open', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'orgCommands.container.01-ready.png');
  });

  await test.step('Authorize an Org', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('Authorize a Dev Hub', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_dev_hub_text, 60_000);
  });

  await test.step('Set a Default Org', async () => {
    await verifyCommandExists(page, packageNls.config_set_org_text, 60_000);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
