/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of orgDisplay.desktop (see docs/adr/0022-code-builder-e2e-desktop-build-over-browser.md).
 * Runs against the single shared container fixture + the one tracking scratch org authed as the
 * default target-org at container boot — no org creation here. `SFDX: Display Org Details for Default
 * Org` shells out to `sf org display --target-org <default> --json` via TerminalService.simpleExec and
 * renders the result as a table; the 'Connected Status' row proves the CLI round-trip + JSON decode +
 * table render completed end-to-end inside the container.
 */

import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';

const ORG_CHANNEL = 'Salesforce Org Management';

// Shared persistent workbench: reset editor + notification state before each test rather than
// assuming a clean slate.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('org extension (Code Builder): SFDX: Display Org Details for Default Org logs the org table to the output channel', async ({
  page
}) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'orgDisplay.container.01-ready.png');
  });

  // Gate on an always-present activation command so we don't get a false negative on slow startup.
  await test.step('verify extension-activated command is present', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('run Display Org Details for Default Org', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_display_default_text);
  });

  await test.step('assert org table in output channel', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, ORG_CHANNEL, 30_000);
    // 'Connected Status' is an unconditional row of formatOrgInfoAsTable; its presence proves the
    // `sf org display --json` round-trip + table render completed against the boot default org.
    await waitForOutputChannelText(page, { expectedText: 'Connected Status', timeout: 60_000 });
    await saveScreenshot(page, 'orgDisplay.container.02-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
