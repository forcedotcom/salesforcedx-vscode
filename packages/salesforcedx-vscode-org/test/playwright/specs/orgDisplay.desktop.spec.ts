/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeWelcomeTabs,
  createMinimalOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedMinimalDefaultTest as test } from '../fixtures';

const ORG_CHANNEL = 'Salesforce Org Management';

// e2e-COVERED: SFDX: Display Org Details for Default Org against a live default org. This path
// shells out to `sf org display --target-org <default> --json` via TerminalService.simpleExec, with
// the username coming from TargetOrgRef — so a live, authed default org is required. The table output
// proves the CLI round-trip + JSON decode + table render end-to-end; jest only covers the
// dispatch/guards with mocks.
test('org extension: SFDX: Display Org Details for Default Org logs the org table to the output channel', async ({
  page
}) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup', async () => {
    if (isContainer) {
      // Shared, persistent workbench: reset editor + notification state rather than assuming a clean
      // slate. No org creation — the container's boot org is the shared tracking scratch org.
      await resetContainerWorkbench(page);
    } else {
      // creates/reuses the minimalTestOrg so the alias in .sfdx/config.json resolves to a live org
      await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'orgDisplay.01-ready.png');
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
    // `sf org display --json` round-trip + table render completed against the live default org.
    await waitForOutputChannelText(page, { expectedText: 'Connected Status', timeout: 60_000 });
    await saveScreenshot(page, 'orgDisplay.02-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
