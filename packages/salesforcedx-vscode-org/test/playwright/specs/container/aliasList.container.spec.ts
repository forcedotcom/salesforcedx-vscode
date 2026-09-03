/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of aliasList.desktop (see docs/adr/0022-code-builder-e2e-desktop-build-over-browser.md).
 * Runs against the single shared container fixture + the one tracking scratch org authed at container
 * boot — its alias is the boot alias (env MINIMAL_ORG_ALIAS, default 'minimalTestOrg'). No org
 * creation here. `SFDX: List All Aliases` shells out via TerminalService and renders the alias table;
 * asserting the Alias/Username headers plus the boot alias proves the CLI round-trip + render reached
 * the output channel with the already-authed org.
 */

import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  MINIMAL_ORG_ALIAS,
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
// Alias the boot org was authed under (orchestrator may override via env; falls back to the shared default).
const bootAlias = process.env.MINIMAL_ORG_ALIAS ?? MINIMAL_ORG_ALIAS;

// Shared persistent workbench: reset editor + notification state before each test rather than
// assuming a clean slate.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('org extension (Code Builder): SFDX: List All Aliases writes aliases to the output channel', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'aliasList.container.01-ready.png');
  });

  await test.step('verify localized command is present', async () => {
    await verifyCommandExists(page, packageNls.alias_list_text, 60_000);
  });

  await test.step('run List All Aliases', async () => {
    await executeCommandWithCommandPalette(page, packageNls.alias_list_text);
  });

  await test.step('assert alias table in output channel', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, ORG_CHANNEL, 30_000);
    await waitForOutputChannelText(page, { expectedText: 'Alias', timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: 'Username', timeout: 60_000 });
    // The boot org was authed under this alias; its appearance proves the live alias list rendered.
    await waitForOutputChannelText(page, { expectedText: bootAlias, timeout: 60_000 });
    await saveScreenshot(page, 'aliasList.container.02-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
