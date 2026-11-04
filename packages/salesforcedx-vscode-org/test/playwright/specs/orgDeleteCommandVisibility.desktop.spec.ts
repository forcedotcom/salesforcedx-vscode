/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeWelcomeTabs,
  createMinimalOrg,
  ensureSecondarySideBarHidden,
  resetContainerWorkbench,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedMinimalDefaultTest as test } from '../fixtures';

// A scratch org is a deletable default (isScratch === true) so sf:default_org_deletable is true
// and SFDX: Delete Default Org must appear in the palette.
// The negative (hidden) case requires a production / non-scratch-non-sandbox default org, for
// which there is no e2e helper; it is covered by the updateContext jest test and manual verification.
test('org extension: SFDX: Delete Default Org is visible when the default org is a scratch org', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup', async () => {
    if (isContainer) {
      // Shared, persistent workbench: reset editor + notification state rather than assuming a clean
      // slate. The container's boot org is already the tracking scratch org default target-org — no
      // org creation here.
      await resetContainerWorkbench(page);
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'orgDeleteCommandVisibility.01-ready.png');
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
